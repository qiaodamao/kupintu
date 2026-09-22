/**
 * 验证预览区缩放控件：视图缩放（− / + / 适应窗口）与选中图片浮层工具条（− / % / + / 复位）。
 * 回归重点：画布容器 setPointerCapture 会把 click 从按钮劫走，导致 onClick 不触发。
 * 用法：node scripts/smoke-view-zoom.mjs [url] [port]
 */
const url = process.argv[2] ?? 'http://localhost:3222/editor/'
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
  source: `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));
  window.__clicks=[];document.addEventListener('click',e=>{window.__clicks.push(e.target.tagName||'?')},true);`,
})
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await sleep(3800)

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })

await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 2; i++) {
    const c = document.createElement('canvas'); c.width = 800; c.height = 800
    const x = c.getContext('2d'); x.fillStyle = ['#ef4444','#2563eb'][i]; x.fillRect(0,0,800,800)
    const blob = await new Promise(r => c.toBlob(r,'image/png'))
    files.push(new File([blob], 'p'+i+'.png', {type:'image/png'}))
  }
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer(); files.forEach(f=>dt.items.add(f))
  input.files = dt.files; input.dispatchEvent(new Event('change',{bubbles:true}))
  return 'ok'
})()`)
await sleep(2500)

const viewZoom = () => evaluate(`(() => { const s = Array.from(document.querySelectorAll('span')).find(s => /^\\d+%$/.test(s.textContent.trim()) && s.className.includes('w-12')); return s ? s.textContent.trim() : null })()`)
const slotZoom = () => evaluate(`(() => { const s = Array.from(document.querySelectorAll('span')).find(s => /^\\d+%$/.test(s.textContent.trim()) && s.className.includes('w-10')); return s ? s.textContent.trim() : null })()`)
const painted = () => evaluate(`(() => { const c = document.querySelector('canvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4*101) if(d[i]>8) n++; return n })()`)

const clickBy = async (sel) => {
  const box = await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(${sel})
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width/2, y: r.top + r.height/2, disabled: b.disabled }
  })()`)
  if (!box) return 'not found'
  await mouse('mouseMoved', box.x, box.y)
  await sleep(120)
  await mouse('mousePressed', box.x, box.y)
  await sleep(70)
  await mouse('mouseReleased', box.x, box.y)
  await sleep(600)
  return 'ok'
}
const byText = (t) => `b => b.textContent.trim() === ${JSON.stringify(t)}`
const byTitle = (t) => `b => (b.title || '').includes(${JSON.stringify(t)})`

const R = {}
R['视图缩放_初始'] = { zoom: await viewZoom(), painted: await painted() }
await clickBy(byText('+'))
R['点+'] = { zoom: await viewZoom(), painted: await painted() }
await clickBy(byText('+'))
R['再点+'] = { zoom: await viewZoom(), painted: await painted() }
await clickBy(byText('−'))
R['点−'] = { zoom: await viewZoom(), painted: await painted() }
await clickBy(byTitle('适应窗口'))
R['适应窗口'] = { zoom: await viewZoom(), painted: await painted() }

// 选中一张图，验证图片浮层工具条
const canvasBox = await evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height } })()`)
await mouse('mouseMoved', canvasBox.left + canvasBox.w * 0.25, canvasBox.top + canvasBox.h * 0.5)
await sleep(150)
await mouse('mousePressed', canvasBox.left + canvasBox.w * 0.25, canvasBox.top + canvasBox.h * 0.5)
await sleep(70)
await mouse('mouseReleased', canvasBox.left + canvasBox.w * 0.25, canvasBox.top + canvasBox.h * 0.5)
await sleep(700)
R['选中图片后'] = { slotZoom: await slotZoom() }
await clickBy(byTitle('放大'))
R['图片放大'] = { slotZoom: await slotZoom() }
await clickBy(byTitle('缩小'))
await clickBy(byTitle('缩小'))
R['图片缩小x2'] = { slotZoom: await slotZoom() }
await clickBy(byTitle('复位'))
R['图片复位'] = { slotZoom: await slotZoom() }

R['click目标'] = await evaluate('JSON.stringify(window.__clicks.slice(-6))')
R.errors = await evaluate('window.__errs || []')
console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
