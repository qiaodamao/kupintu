/**
 * 深色模式对比度回归：浅色底的品牌芯片（bg-brand-50）在 dark 下必须换成深色底，
 * 且文字/图标与底色的对比度要够（曾因品牌色板只定义到 700、dark:bg-brand-950 缺失，
 * 深色模式下仍是近白底 + 浅紫字，既刺眼又看不清）。
 * 用法：node scripts/smoke-dark-mode.mjs [baseUrl] [port]
 */
const base = (process.argv[2] ?? 'http://localhost:3222/editor/').replace(/\/editor\/?$/, '')
const port = Number(process.argv[3] ?? 9333)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(500)
  }
  throw new Error('无法连接 Chrome DevTools')
}
const ws = new WebSocket(await getWs())
let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
await send('Runtime.enable')
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));`,
})

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })

/** 页面内计算：相对亮度 + 两色对比度（WCAG） */
const HELPERS = `
window.__lum = (str) => {
  const m = str.match(/rgba?\\(([^)]+)\\)/)
  if (!m) return null
  const [r, g, b] = m[1].split(',').map(Number)
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
window.__contrast = (a, b) => {
  const la = window.__lum(a), lb = window.__lum(b)
  if (la === null || lb === null) return null
  const hi = Math.max(la, lb), lo = Math.min(la, lb)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}
`

const enableDark = async () => {
  await evaluate(HELPERS)
  const box = await evaluate(`(() => {
    const b = document.querySelector('button[aria-label="切换主题"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, dark: document.documentElement.classList.contains('dark') }
  })()`)
  if (!box) return 'no-toggle'
  if (!box.dark) {
    await mouse('mousePressed', box.x, box.y)
    await mouse('mouseReleased', box.x, box.y)
    await sleep(600)
  }
  const isDark = await evaluate(`document.documentElement.classList.contains('dark')`)
  return isDark ? 'ok' : 'dark-not-enabled'
}

/** 扫所有写了 bg-brand-50 的元素（浅色芯片），读出深/浅模式下的实际底色与前景色 */
const PROBE = `(() => {
  const els = Array.from(document.querySelectorAll('*')).filter((e) =>
    typeof e.className === 'string' && e.className.includes('bg-brand-50') && e.offsetParent !== null,
  )
  return els.map((e) => {
    const cs = getComputedStyle(e)
    const fg = getComputedStyle(e).color
    return {
      text: (e.innerText || e.getAttribute('aria-label') || (e.querySelector('svg') ? 'icon' : '')).slice(0, 14),
      bg: cs.backgroundColor,
      fg,
      bgLum: Math.round((window.__lum(cs.backgroundColor) ?? -1) * 1000) / 1000,
      contrast: window.__contrast(fg, cs.backgroundColor),
    }
  })
})()`

const R = {}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
// 先强制浅色：上一轮跑完会把 kupintu-theme=dark 写进 localStorage，不重置的话浅色基准读到的是深色值
await send('Page.navigate', { url: base + '/' })
await sleep(1500)
await evaluate(`(() => {
  localStorage.setItem('kupintu-theme', 'light')
  document.documentElement.classList.remove('dark')
  return true
})()`)
await send('Page.navigate', { url: base + '/' })
await sleep(2200)
await evaluate(HELPERS)
// 主题初始化脚本可能又把 dark 类加回来（水合时机），探针前再确认一次
R['浅色模式isDark'] = await evaluate(`(() => {
  if (document.documentElement.classList.contains('dark')) document.documentElement.classList.remove('dark')
  return document.documentElement.classList.contains('dark')
})()`)
await sleep(300)

R['浅色模式'] = { 芯片: await evaluate(PROBE) }

const st = await enableDark()
R['切换深色'] = st
await sleep(500)
const darkChips = await evaluate(PROBE)
R['深色模式'] = { 芯片: darkChips }

// 深色下：底色必须真的是深色（亮度 < 0.2），且前景对比度 >= 4.5
const bad = darkChips.filter((c) => c.bgLum > 0.2 || (c.contrast !== null && c.contrast < 4.5))
R['深色不合格项'] = bad
R['控制台错误'] = await evaluate('window.__errs || []')
console.log(JSON.stringify(R, null, 2))
console.log('\n结论:', darkChips.length > 0 && bad.length === 0
  ? `PASS 深色模式下 ${darkChips.length} 处品牌芯片均为深色底且对比度达标`
  : 'FAIL')
ws.close()
process.exit(0)
