/**
 * 验证「布局拼图」模式下悬停图片间距处的分割线提示：
 * 光标应变为 col-resize / row-resize，并出现高亮线 + 手柄，拖动可改比例。
 * 用法：node scripts/smoke-split-hint.mjs [url] [port]
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
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}) => {
  const msgId = ++id
  ws.send(JSON.stringify({ id: msgId, method, params }))
  return new Promise((resolve) => pending.set(msgId, resolve))
}

await send('Runtime.enable')
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));`,
})
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await sleep(4000)

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.exception?.description }
  return res.result?.result?.value
}
const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra })

/** 扫描画布像素，找出红/蓝之间的白色缝隙中心线（即分割线的屏幕坐标） */
const LOCATE = `(() => {
  const c = document.querySelector('canvas')
  const rect = c.getBoundingClientRect()
  const dpr = c.width / rect.width
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  const isRed = i => d[i] > 180 && d[i+1] < 110 && d[i+2] < 110
  const isBlue = i => d[i+2] > 150 && d[i] < 110
  const isWhite = i => d[i] > 240 && d[i+1] > 240 && d[i+2] > 240
  const runsOnLine = (fixed, len, horizontal) => {
    const out = []
    let s = -1
    for (let k = 0; k < len; k++) {
      const i = (horizontal ? (fixed * c.width + k) : (k * c.width + fixed)) * 4
      const w = d[i+3] > 200 && isWhite(i)
      if (w && s < 0) s = k
      if (!w && s >= 0) { out.push([s, k - 1]); s = -1 }
    }
    if (s >= 0) out.push([s, len - 1])
    return out
  }
  const hasPair = (i1, i2) => (isRed(i1) && isBlue(i2)) || (isBlue(i1) && isRed(i2))
  // 竖直分割线：沿水平中线扫描
  const midY = Math.round(c.height / 2)
  for (const [a, b] of runsOnLine(midY, c.width, true)) {
    const i1 = (midY * c.width + Math.max(0, a - 8)) * 4
    const i2 = (midY * c.width + Math.min(c.width - 1, b + 8)) * 4
    if (hasPair(i1, i2)) return { dir: 'v', x: rect.left + (a + b) / 2 / dpr, y: rect.top + midY / dpr }
  }
  // 水平分割线：沿垂直中线扫描
  const midX = Math.round(c.width / 2)
  for (const [a, b] of runsOnLine(midX, c.height, false)) {
    const i1 = (Math.max(0, a - 8) * c.width + midX) * 4
    const i2 = (Math.min(c.height - 1, b + 8) * c.width + midX) * 4
    if (hasPair(i1, i2)) return { dir: 'h', x: rect.left + midX / dpr, y: rect.top + (a + b) / 2 / dpr }
  }
  return null
})()`

const PROBE = `(() => {
  const wrap = document.querySelector('canvas').parentElement
  const handle = document.querySelector('svg path[d^="M10 8"]') || document.querySelector('svg path[d^="M8 10"]')
  return {
    cursor: wrap.style.cursor,
    handle: !!handle,
    tip: Array.from(document.querySelectorAll('div')).some(d => d.textContent === '拖动可调整两侧图片占比'),
  }
})()`

const R = {}

// 1. 上传 2 张纯色图（红 / 蓝）
await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 2; i++) {
    const c = document.createElement('canvas')
    c.width = 800; c.height = 800
    const ctx = c.getContext('2d')
    ctx.fillStyle = ['#ef4444', '#2563eb'][i]
    ctx.fillRect(0, 0, 800, 800)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    files.push(new File([blob], 'p' + i + '.png', { type: 'image/png' }))
  }
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer()
  files.forEach(f => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})()`)
await sleep(3000)

const measure = (dir) =>
  evaluate(`(() => {
    const c = document.querySelector('canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    const isRed = i => d[i] > 180 && d[i+1] < 110 && d[i+2] < 110
    let n = 0
    if (${JSON.stringify(dir)} === 'v') {
      const y = Math.round(c.height / 2)
      for (let x = 0; x < c.width; x++) if (isRed((y*c.width+x)*4)) n++
    } else {
      const x = Math.round(c.width / 2)
      for (let y = 0; y < c.height; y++) if (isRed((y*c.width+x)*4)) n++
    }
    return n
  })()`)

async function checkGap(label, expectDir) {
  const gap = await evaluate(LOCATE)
  if (!gap || gap.dir !== expectDir) return { [label]: '未找到分割线 ' + expectDir }
  // 对照组：图片内部
  const c = await evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height } })()`)
  const inside = { x: c.left + c.w * 0.2, y: c.top + c.h * 0.2 }
  await mouse('mouseMoved', inside.x, inside.y)
  await sleep(350)
  const ctrl = await evaluate(PROBE)

  await mouse('mouseMoved', gap.x, gap.y)
  await sleep(350)
  const hover = await evaluate(PROBE)

  const before = await measure(gap.dir)
  await mouse('mousePressed', gap.x, gap.y)
  await sleep(100)
  const dx = gap.dir === 'v' ? -130 : 0
  const dy = gap.dir === 'h' ? -130 : 0
  for (let i = 1; i <= 10; i++) {
    await mouse('mouseMoved', gap.x + (dx * i) / 10, gap.y + (dy * i) / 10)
    await sleep(40)
  }
  const dragging = await evaluate(PROBE)
  await mouse('mouseReleased', gap.x + dx, gap.y + dy)
  await sleep(700)
  const after = await measure(gap.dir)

  return {
    [label]: {
      dir: gap.dir,
      图片内: ctrl,
      悬停缝隙: hover,
      拖动中: dragging,
      拖动生效: { before, after, changed: Math.abs(after - before) > 20 },
    },
  }
}

Object.assign(R, await checkGap('默认模板', 'v'))

// 2. 切换到含水平分割的模板，验证 row-resize
const tpl = await evaluate(`(() => {
  const box = document.querySelector('[class*="grid-cols-3"]')
  if (!box) return 'no template box'
  const btns = Array.from(box.querySelectorAll('button'))
  return btns.length
})()`)
R.模板数量 = tpl
let found = null
for (let i = 0; i < Math.min(tpl || 0, 12); i++) {
  await evaluate(`(() => { document.querySelectorAll('[class*="grid-cols-3"] button')[${i}].click(); return 1 })()`)
  await sleep(700)
  const g = await evaluate(LOCATE)
  if (g && g.dir === 'h') {
    found = i
    break
  }
}
if (found === null) {
  R.水平分割 = '未找到含水平分割的模板'
} else {
  R.水平分割模板序号 = found
  Object.assign(R, await checkGap('水平分割', 'h'))
}

R.errors = await evaluate('window.__errs || []')
console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
