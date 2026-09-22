/**
 * 验证移动端预览区双指捏合：缩放的是画布，不是整个页面。
 * 用法：node scripts/smoke-pinch.mjs [url] [port]
 */
const url = process.argv[2] ?? 'http://localhost:3000/editor/'
const port = Number(process.argv[3] ?? 9333)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await res.json()
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
  const mid = ++id
  ws.send(JSON.stringify({ id: mid, method, params }))
  return new Promise((res) => pending.set(mid, res))
}
await send('Runtime.enable')
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));`,
})
// 移动端视口 + 触摸事件模拟
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url })
await sleep(4000)

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}
const touch = (type, points) => send('Input.dispatchTouchEvent', { type, touchPoints: points })

const R = {}

// 上传 3 张图，保证画布有内容
await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas'); c.width = 300; c.height = 300
    const x = c.getContext('2d'); x.fillStyle = ['#ef4444','#2563eb','#22c55e'][i%3]; x.fillRect(0,0,300,300)
    const blob = await new Promise(r => c.toBlob(r,'image/png'))
    files.push(new File([blob], 'p'+i+'.png', {type:'image/png'}))
  }
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer(); files.forEach(f=>dt.items.add(f))
  input.files = dt.files; input.dispatchEvent(new Event('change',{bubbles:true}))
  return 'ok'
})()`)
await sleep(3500)

// 缩放百分比（右下角控件）+ 页面缩放比例 + 页面滚动
const stateNow = () => evaluate(`(() => {
  const span = Array.from(document.querySelectorAll('span')).find(s => /^\\d+%$/.test(s.textContent.trim()) && s.className.includes('font-mono'))
  const wrap = document.querySelector('canvas')?.parentElement
  return {
    zoom: span ? span.textContent.trim() : null,
    pageScale: window.visualViewport ? Number(window.visualViewport.scale.toFixed(3)) : null,
    scrollY: Math.round(window.scrollY || 0),
    touchAction: wrap ? getComputedStyle(wrap).touchAction : null,
  }
})()`)

R['1_初始'] = await stateNow()

// 画布中心（视口坐标）
const box = await evaluate(`(() => {
  const r = document.querySelector('canvas').getBoundingClientRect()
  return { cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) }
})()`)
R['画布中心'] = box

// 双指张开：间距 80 → 200（期望画布放大约 2.5 倍，但页面不能被缩放）
const pinch = async (from, to) => {
  const pts = (d) => [
    { x: box.cx - d / 2, y: box.cy },
    { x: box.cx + d / 2, y: box.cy },
  ]
  await touch('touchStart', pts(from))
  await sleep(120)
  for (const d of [from + (to - from) * 0.3, from + (to - from) * 0.6, to]) {
    await touch('touchMove', pts(d))
    await sleep(90)
  }
  await touch('touchEnd', [])
  await sleep(600)
}

await pinch(80, 200)
R['2_双指张开后'] = await stateNow()

// 双指捏合：间距 200 → 70（画布应当缩小，且不小于下限）
await pinch(200, 70)
R['3_双指捏合后'] = await stateNow()

R.errors = await evaluate('window.__errs || []')

console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
