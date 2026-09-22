/**
 * 移动端顶栏适配回归：各断点下 header 不得溢出、关键按钮必须可见可点
 * 用法：node scripts/smoke-mobile-header.mjs [baseUrl] [port]
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

const PROBE = `(() => {
  const vw = window.innerWidth
  const h = document.querySelector('header')
  const kids = Array.from(h.children)
  const vis = kids.filter((c) => getComputedStyle(c).display !== 'none')
  const last = vis[vis.length - 1]
  const lastR = last ? last.getBoundingClientRect() : null
  const exportBtn = Array.from(h.querySelectorAll('button')).find((b) => b.textContent.includes('导出'))
  const er = exportBtn ? exportBtn.getBoundingClientRect() : null
  const tools = Array.from(h.querySelectorAll('button')).filter(
    (b) => ['选择 / 拖拽', '文字', '箭头', '方框', '圆圈'].includes(b.title) && b.offsetParent !== null,
  )
  return {
    vw,
    headerOverflow: h.scrollWidth - h.clientWidth,
    exportVisible: !!er && er.width > 0 && er.right <= vw + 0.5 && er.left >= -0.5,
    exportBox: er ? [Math.round(er.left), Math.round(er.right)] : null,
    toolBtnsInTop: tools.length,
    lastRight: lastR ? Math.round(lastR.right) : null,
  }
})()`

const clickText = (txt) => evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('header button')).find((b) => b.textContent.includes(${JSON.stringify(txt)}) || b.title === ${JSON.stringify(txt)})
  if (!b) return false
  const r = b.getBoundingClientRect()
  window.__lastBox = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  return true
})()`)

const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })

const R = {}
const results = []

for (const [name, w, h, toLong] of [
  ['320', 320, 720, true],
  ['390-布局', 390, 844, false],
  ['390-长图', 390, 844, true],
  ['768', 768, 1024, true],
  ['1024', 1024, 800, true],
]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 })
  await send('Page.navigate', { url: base + '/editor/' })
  await sleep(2600)
  if (toLong) {
    await clickText('长图拼接')
    const box = await evaluate('window.__lastBox')
    await mouse('mousePressed', box.x, box.y)
    await mouse('mouseReleased', box.x, box.y)
    await sleep(1400)
  }
  const p = await evaluate(PROBE)
  const ok = p.headerOverflow === 0 && p.exportVisible && !p.error
  results.push({ name, ...p, ok })
  R[name] = { 溢出: p.headerOverflow, 导出可见: p.exportVisible, 右边界: p.exportBox, 顶部工具按钮: p.toolBtnsInTop }
}

/* 390 下点「导出」应弹出导出面板 */
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Page.navigate', { url: base + '/editor/' })
await sleep(2600)
await clickText('导出')
let box = await evaluate('window.__lastBox')
await mouse('mousePressed', box.x, box.y)
await mouse('mouseReleased', box.x, box.y)
await sleep(1200)
R['导出弹窗'] = await evaluate(`(() => document.body.innerText.includes('下载图片') ? '已打开' : '未打开')()`)

R['控制台错误'] = await evaluate('window.__errs || []')
console.log(JSON.stringify(R, null, 2))
console.log('\n结论:', results.every((r) => r.ok) ? 'PASS 所有断点顶栏无溢出且导出按钮可见' : 'FAIL')
ws.close()
process.exit(0)
