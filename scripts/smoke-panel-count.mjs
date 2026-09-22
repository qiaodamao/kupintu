/**
 * 验证右侧「布局模板」面板的 1~30 数量按钮全部可见、可点击。
 * 用法：node scripts/smoke-panel-count.mjs [url] [port]
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
  source: `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));`,
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

// 上传 30 张小图，确保 1~30 全部可点
await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 30; i++) {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200
    const x = c.getContext('2d'); x.fillStyle = ['#ef4444','#2563eb','#22c55e'][i%3]; x.fillRect(0,0,200,200)
    const blob = await new Promise(r => c.toBlob(r,'image/png'))
    files.push(new File([blob], 'p'+i+'.png', {type:'image/png'}))
  }
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer(); files.forEach(f=>dt.items.add(f))
  input.files = dt.files; input.dispatchEvent(new Event('change',{bubbles:true}))
  return 'ok'
})()`)
await sleep(3500)

// 检查 1~30 按钮的可见性：是否都在右侧栏可视范围内、宽度是否够
const R = {}
R.按钮布局 = await evaluate(`(() => {
  const btns = Array.from(document.querySelectorAll('button')).filter(b => /^\\d+$/.test(b.textContent.trim()) && b.className.includes('h-7'))
  if (btns.length !== 30) return '按钮数量异常: ' + btns.length
  const panel = btns[0].closest('aside')
  const pr = panel.getBoundingClientRect()
  const rows = new Map()
  const bad = []
  for (const b of btns) {
    const r = b.getBoundingClientRect()
    const n = b.textContent.trim()
    const clipped = r.right > pr.right + 0.5 || r.left < pr.left - 0.5
    const hiddenByParent = b.offsetParent === null
    if (clipped || hiddenByParent || r.width < 20) bad.push({ n, w: Math.round(r.width), clipped, hiddenByParent })
    const key = Math.round(r.top)
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key).push(n)
  }
  const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b)
  return {
    panelWidth: Math.round(pr.width),
    buttonWidth: Math.round(btns[0].getBoundingClientRect().width),
    rows: rowKeys.map((k) => rows.get(k).join(',')),
    invisible: bad,
  }
})()`)

// 当前选中的数量（按钮高亮为 brand 底色）
const activeNum = () => evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(b => /^\\d+$/.test(b.textContent.trim()) && b.className.includes('h-7') && b.className.includes('bg-brand-600'))
  return b ? b.textContent.trim() : null
})()`)
R['选中_初始'] = await activeNum()

const clickNum = async (n) => {
  const box = await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(String(n))} && b.className.includes('h-7'))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width/2, y: r.top + r.height/2, disabled: b.disabled }
  })()`)
  if (!box) return 'not found'
  if (box.disabled) return 'disabled(图片数不足)'
  await mouse('mouseMoved', box.x, box.y)
  await sleep(120)
  await mouse('mousePressed', box.x, box.y)
  await sleep(70)
  await mouse('mouseReleased', box.x, box.y)
  await sleep(800)
  return { 选中: await activeNum() }
}

R['点击9'] = await clickNum(9)
R['点击16'] = await clickNum(16)
R['点击30'] = await clickNum(30)
R['格子数_点30后'] = await evaluate(`(() => {
  const st = window.__store?.getState()
  if (!st) return 'no store'
  return { 叶子数: st.tree ? (function c(n){return n.kind==='leaf'?1:c(n.a)+c(n.b)})(st.tree) : null, 图片数: st.images.length }
})()`)
R.errors = await evaluate('window.__errs || []')

console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
