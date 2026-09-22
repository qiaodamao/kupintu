/**
 * 预览区滚轮缩放回归测试
 * 智能区分：光标在图片上 → 缩放该图片；光标在空白处 → 缩放整个预览画布（以光标为锚点）
 * 修饰键：Ctrl / Alt + 滚轮 → 任意位置都缩放画布
 * 用法：node scripts/smoke-view-wheel.mjs [url] [port]
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
const wheel = (x, y, deltaY, modifiers = 0) =>
  send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY, modifiers })

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

/* ---------- 探针 ---------- */
await evaluate(`
  window.__probe = {
    zoomPct() {
      const s = Array.from(document.querySelectorAll('span')).find((x) => /^\\d+%$/.test(x.textContent.trim()))
      return s ? s.textContent.trim() : null
    },
    zoomEls() {
      return Array.from(document.querySelectorAll('span'))
        .map((x) => x.textContent.trim())
        .filter((t) => t.length <= 6)
        .slice(0, 12)
    },
    /** 画布实际绘制区域（不透明像素包围盒），视口 CSS 坐标 */
    contentBox() {
      const c = document.querySelector('canvas')
      const rect = c.getBoundingClientRect()
      const dpr = c.width / rect.width
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
      for (let y = 0; y < c.height; y += 2)
        for (let x = 0; x < c.width; x += 2) {
          const i = (y * c.width + x) * 4
          if (d[i + 3] > 200) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
        }
      if (x1 < 0) return null
      return { left: +(rect.left + x0 / dpr).toFixed(1), top: +(rect.top + y0 / dpr).toFixed(1),
               right: +(rect.left + x1 / dpr).toFixed(1), bottom: +(rect.top + y1 / dpr).toFixed(1) }
    },
    wrap() {
      const c = document.querySelector('canvas')
      const r = (c.parentElement || c).getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    },
    centroid(kind) {
      const c = document.querySelector('canvas')
      const rect = c.getBoundingClientRect()
      const dpr = c.width / rect.width
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      const tests = {
        red: (r,g,b) => r > 200 && g < 170 && b < 170,
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
    errs() { return window.__errs || [] },
  };
  'ok'
`)

const R = {}
const A = await evaluate('window.__probe.centroid("red")')
const wrap = await evaluate('window.__probe.wrap()')
if (!A || !wrap) {
  console.log('无法定位图片区域或预览容器', JSON.stringify({ A, wrap }))
  ws.close()
  process.exit(1)
}

/** 预览容器左侧空白带（画布之外的区域）：取容器左边 24px 处 */
const blank = { x: wrap.left + 24, y: wrap.top + wrap.height / 2 }
const dist = (p, q) => Math.round(Math.hypot(p.x - q.x, p.y - q.y))
const box0 = await evaluate('window.__probe.contentBox()')
R.debug_zoomEls = await evaluate('window.__probe.zoomEls()')
/** 空白点必须落在画布之外，否则测到的是图片缩放 */
R.blankOutsideCanvas = blank.x < box0.left - 4

/* ---------- 1. 空白处滚轮 → 缩放画布（缩小，保证内容完整可见） ---------- */
const zoom0 = await evaluate('window.__probe.zoomPct()')
await mouse('mouseMoved', blank.x, blank.y)
await sleep(200)
for (let i = 0; i < 3; i++) {
  await wheel(blank.x, blank.y, 120)
  await sleep(150)
}
await sleep(500)
const zoom1 = await evaluate('window.__probe.zoomPct()')
const box1 = await evaluate('window.__probe.contentBox()')
R['1_空白处滚轮'] = { zoom: `${zoom0} → ${zoom1}`, changed: zoom0 !== zoom1 }

/* 锚点校验：光标下的画布点在缩放前后应停在同一屏幕位置 */
if (box0 && box1) {
  const u = (blank.x - box0.left) / (box0.right - box0.left)
  const v = (blank.y - box0.top) / (box0.bottom - box0.top)
  const expectX = box1.left + u * (box1.right - box1.left)
  const expectY = box1.top + v * (box1.bottom - box1.top)
  R['1_锚点校验'] = {
    相对位置: { u: +u.toFixed(3), v: +v.toFixed(3) },
    期望光标处落点: { x: Math.round(expectX), y: Math.round(expectY) },
    实际光标: { x: Math.round(blank.x), y: Math.round(blank.y) },
    偏差px: Math.round(Math.hypot(expectX - blank.x, expectY - blank.y)),
  }
}

/* ---------- 2. 图片上滚轮 → 缩放图片，画布缩放不变 ---------- */
const zoomBeforeImg = await evaluate('window.__probe.zoomPct()')
const mark0 = await evaluate('window.__probe.centroid("mark")')
await mouse('mouseMoved', A.x, A.y)
await sleep(200)
for (let i = 0; i < 6; i++) {
  await wheel(A.x, A.y, -120)
  await sleep(120)
}
await sleep(600)
const zoomAfterImg = await evaluate('window.__probe.zoomPct()')
const mark1 = await evaluate('window.__probe.centroid("mark")')
R['2_图片上滚轮'] = {
  画布缩放: `${zoomBeforeImg} → ${zoomAfterImg}`,
  画布未变: zoomBeforeImg === zoomAfterImg,
  图片内容位移px: mark0 && mark1 ? dist(mark0, mark1) : null,
}

/* ---------- 3. Ctrl + 滚轮（光标在图片上）→ 强制缩放画布 ---------- */
const zoomBeforeCtrl = await evaluate('window.__probe.zoomPct()')
await mouse('mouseMoved', A.x, A.y)
await sleep(200)
for (let i = 0; i < 2; i++) {
  await wheel(A.x, A.y, -120, 2) // Ctrl
  await sleep(150)
}
await sleep(500)
R['3_Ctrl滚轮'] = { zoom: `${zoomBeforeCtrl} → ${await evaluate('window.__probe.zoomPct()')}` }

/* ---------- 4. 适应窗口复位 ---------- */
const fitBtn = await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find((b) => b.title && b.title.includes('适应窗口'))
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`)
if (fitBtn) {
  await mouse('mousePressed', fitBtn.x, fitBtn.y)
  await sleep(80)
  await mouse('mouseReleased', fitBtn.x, fitBtn.y)
  await sleep(600)
}
R['4_适应窗口'] = await evaluate('window.__probe.zoomPct()')

R.errors = await evaluate('window.__probe.errs()')
console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
