/**
 * 站点 Logo 校验：首页与编辑器页的 logo 都应指向 /icon.svg 并成功解码
 * 用法：node scripts/smoke-logo.mjs [baseUrl] [port]
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}

const check = async (path) => {
  await send('Page.navigate', { url: base + path })
  await sleep(2500)
  return evaluate(`(() => {
    const img = Array.from(document.querySelectorAll('img')).find((i) => i.src.includes('icon.svg'))
    if (!img) return { found: false }
    const r = img.getBoundingClientRect()
    return {
      found: true,
      src: new URL(img.src).pathname,
      loaded: img.complete && img.naturalWidth > 0,
      natural: img.naturalWidth + 'x' + img.naturalHeight,
      rendered: Math.round(r.width) + 'x' + Math.round(r.height),
      alt: img.alt,
    }
  })()`)
}

const R = {}
R['首页'] = await check('/')
R['编辑器'] = await check('/editor/')
R['favicon'] = await evaluate(`(() => {
  const l = document.querySelector('link[rel="icon"]')
  return l ? l.getAttribute('href') : null
})()`)
R.errors = await evaluate('window.__errs || []')
console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
