/**
 * 选中框圆角回归：选中/悬停描边的圆角必须跟随「圆角」样式（样式为 0 时描边必须是直角）。
 * 曾把描边写成固定 rounded-lg(8px)，样式圆角设 0 后图片是方的、选中框却是圆的。
 * 用法：node scripts/smoke-selection-radius.mjs [url] [port]
 */
const url = process.argv[2] ?? 'http://localhost:3222/editor/'
const port = Number(process.argv[3] ?? 9333)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 30; i++) {
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

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await sleep(2600)

const R = {}
R['上传'] = await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas')
    c.width = 900; c.height = 700
    const ctx = c.getContext('2d')
    ctx.fillStyle = ['#f87171', '#60a5fa', '#34d399'][i]
    ctx.fillRect(0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    files.push(new File([blob], 'p' + i + '.png', { type: 'image/png' }))
  }
  const input = document.querySelector('input[type=file]')
  if (!input) return 'no input'
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})()`)
await sleep(2500)

/** 拖动「圆角」滑块（label 与 input 是兄弟结构：span.closest('div').parentElement） */
const setRadius = (v) => evaluate(`(() => {
  const span = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === '圆角')
  const slider = span ? span.closest('div').parentElement.querySelector('input[type=range]') : null
  if (!slider) return 'no slider'
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(slider, '${v}')
  slider.dispatchEvent(new Event('input', { bubbles: true }))
  slider.dispatchEvent(new Event('change', { bubbles: true }))
  return slider.value
})()`)

/** 选中一张图：点画布偏左上（避开中心可能的分割线） */
const pt = await evaluate(`(() => {
  const c = document.querySelector('canvas')
  const r = c.getBoundingClientRect()
  return { x: Math.round(r.left + r.width * 0.28), y: Math.round(r.top + r.height * 0.28) }
})()`)
await mouse('mousePressed', pt.x, pt.y)
await mouse('mouseReleased', pt.x, pt.y)
await sleep(700)

const READ = `(() => {
  const divs = Array.from(document.querySelectorAll('div')).filter((d) =>
    typeof d.className === 'string' && d.className.includes('border-brand-') && d.className.includes('absolute'),
  )
  return divs.map((d) => parseFloat(getComputedStyle(d).borderTopLeftRadius))
})()`

R['圆角=0'] = { 设置: await setRadius(0), 描边圆角: await evaluate(READ) }
await sleep(500)
R['圆角=24'] = { 设置: await setRadius(24), 描边圆角: await evaluate(READ) }
R['控制台错误'] = await evaluate('window.__errs || []')

const r0 = R['圆角=0']['描边圆角']
const r24 = R['圆角=24']['描边圆角']
const ok =
  R['上传'] === 'ok' &&
  r0.length === 1 && Math.abs(r0[0]) < 0.6 &&
  r24.length === 1 && r24[0] > 4 &&
  (R['控制台错误'] || []).length === 0
console.log(JSON.stringify(R, null, 2))
console.log('\n结论:', ok ? 'PASS 描边圆角跟随样式（0 → 直角，24 → 约 16px）' : 'FAIL')
ws.close()
process.exit(0)
