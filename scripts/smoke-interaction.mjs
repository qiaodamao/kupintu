/**
 * 交互回归测试：滚轮缩放图片 / 放大后左键拖动调整位置 / Shift 拖动交换 / 撤销事务合并
 * 用法：node scripts/smoke-interaction.mjs [url] [port]
 * 依赖：本机 Chrome 已开启 --remote-debugging-port=<port>
 */
const url = process.argv[2] ?? 'http://localhost:3222/editor/'
const port = Number(process.argv[3] ?? 9333)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* 等待浏览器 */
    }
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
  source: `
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push(String(e.message || e)));
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('promise: ' + String(e.reason)));
    const __oe = console.error;
    console.error = function (...a) { window.__errs.push('console: ' + a.map(String).join(' ')); __oe.apply(console, a) };
  `,
})
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await sleep(3500)

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.exception?.description ?? 'eval error' }
  return res.result?.result?.value
}
const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...extra })

/* ---------- 上传 2 张带标记图（红底+左上黄块 / 蓝底+右下黄块） ---------- */
await evaluate(`(async () => {
  const make = (bg, at) => {
    const c = document.createElement('canvas')
    c.width = 900; c.height = 900
    const ctx = c.getContext('2d')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 900, 900)
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(at[0], at[1], 220, 220)
    return c
  }
  const files = []
  for (const [i, spec] of [['#f87171', [80, 80]], ['#60a5fa', [600, 600]]].entries()) {
    const blob = await new Promise((r) => make(spec[0], spec[1]).toBlob(r, 'image/png'))
    files.push(new File([blob], 'smoke' + i + '.png', { type: 'image/png' }))
  }
  const input = document.querySelector('input[type=file]')
  if (!input) return 'no input'
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'uploaded'
})()`)
await sleep(2500)

/* ---------- 探针：颜色质心 + 提示条 + 格子框 ---------- */
await evaluate(`
  window.__probe = {
    centroid(kind) {
      const c = document.querySelector('canvas')
      const rect = c.getBoundingClientRect()
      const dpr = c.width / rect.width
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      const tests = {
        red: (r,g,b) => r > 200 && g < 170 && b < 170,
        blue: (r,g,b) => b > 200 && r < 170 && g > 120 && g < 210,
        mark: (r,g,b) => r > 210 && g > 150 && g < 215 && b < 110,
      }
      const t = tests[kind]
      let sx = 0, sy = 0, n = 0
      for (let y = 0; y < c.height; y += 2)
        for (let x = 0; x < c.width; x += 2) {
          const i = (y * c.width + x) * 4
          if (d[i+3] > 200 && t(d[i], d[i+1], d[i+2])) { sx += x; sy += y; n++ }
        }
      return n ? { x: +(rect.left + sx / n / dpr).toFixed(1), y: +(rect.top + sy / n / dpr).toFixed(1), px: n } : null
    },
    hint() {
      const els = Array.from(document.querySelectorAll('div')).filter((e) => e.textContent.includes('已放大') || e.textContent.includes('按住左键'))
      return els.length ? els[els.length - 1].textContent.replace(/\\s+/g, ' ').trim().slice(0, 130) : null
    },
    dragCursor() {
      const c = document.querySelector('canvas')
      return { cursor: c?.parentElement?.style?.cursor ?? null, selection: document.querySelectorAll('div.border-brand-500').length }
    },
    errs() { return window.__errs || [] },
  };
  'ok'
`)

const R = {}
const A = await evaluate('window.__probe.centroid("red")')
const B = await evaluate('window.__probe.centroid("blue")')
if (!A || !B) {
  console.log('无法定位图片区域', JSON.stringify({ A, B }))
  ws.close()
  process.exit(1)
}
const dist = (p, q) => Math.round(Math.hypot(p.x - q.x, p.y - q.y))

const drag = async (from, to, modifiers = 0) => {
  await mouse('mouseMoved', from.x, from.y)
  await sleep(150)
  await mouse('mousePressed', from.x, from.y, { modifiers })
  await sleep(80)
  let mid = null
  for (let i = 1; i <= 8; i++) {
    await mouse('mouseMoved', from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8, { modifiers })
    await sleep(50)
    if (i === 5) mid = await evaluate('window.__probe.dragCursor()')
  }
  await mouse('mouseReleased', to.x, to.y, { modifiers })
  await sleep(500)
  return mid
}

/* 1. 滚轮放大（以光标为锚点） */
await mouse('mouseMoved', A.x, A.y)
await sleep(250)
const mark0 = await evaluate('window.__probe.centroid("mark")')
for (let i = 0; i < 6; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(A.x), y: Math.round(A.y), deltaX: 0, deltaY: -120 })
  await sleep(120)
}
await sleep(700)
R.wheel = { markMoved: dist(await evaluate('window.__probe.centroid("mark")'), mark0) }

/* 2. 左键拖动：应平移图片，且不交换 */
const mark1 = await evaluate('window.__probe.centroid("mark")')
R.drag = await drag(A, B)
R.drag.markMoved = dist(await evaluate('window.__probe.centroid("mark")'), mark1)
R.drag.redStayedInCell = dist(await evaluate('window.__probe.centroid("red")'), A)
R.drag.hint = await evaluate('window.__probe.hint()')

/* 3. 撤销事务：第 1 次回退拖动，第 2 次回退整轮滚轮 */
const undo = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 })
  await sleep(700)
}
await undo()
R.undo1 = { hint: await evaluate('window.__probe.hint()') }
await undo()
R.undo2 = { hint: await evaluate('window.__probe.hint()') }

/* 4. Shift + 拖动：应交换图片 */
await drag(A, B, 8)
R.shiftDrag = {
  redMovedToBlueCell: dist(await evaluate('window.__probe.centroid("red")'), B),
  redStillAtOrigin: dist(await evaluate('window.__probe.centroid("red")'), A),
}

R.errors = await evaluate('window.__probe.errs()')
console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
