/**
 * 浏览器端冒烟测试：用 CDP 驱动本机 Chrome 打开编辑器，
 * 模拟上传 3 张图片，检查画布渲染、模板数量、导出面板与控制台错误。
 * 用法：node scripts/smoke.mjs [url] [port]
 */
const url = process.argv[2] ?? 'http://localhost:3111/editor/'
const port = Number(process.argv[3] ?? 9333)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* 等待浏览器启动 */
    }
    await sleep(500)
  }
  throw new Error('无法连接 Chrome DevTools')
}

const ws = new WebSocket(await getWs())
let id = 0
const pending = new Map()
const events = []

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method) {
    events.push(msg)
  }
})
await new Promise((r) => ws.addEventListener('open', r))

function send(method, params = {}) {
  const msgId = ++id
  ws.send(JSON.stringify({ id: msgId, method, params }))
  return new Promise((resolve) => pending.set(msgId, resolve))
}

await send('Runtime.enable')
await send('Page.enable')
await send('Log.enable')
await send('Runtime.addBinding', { name: '__noop' }).catch(() => {})
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push(String(e.message || e)));
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('promise: ' + String(e.reason)));
    const __oe = console.error;
    console.error = function (...a) { window.__errs.push('console: ' + a.map(String).join(' ')); __oe.apply(console, a) };
  `,
})

await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})
await send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: 'C:/Users/admin/AppData/Local/Temp/kp-downloads',
}).catch(() => {})

await send('Page.navigate', { url })
await sleep(3500)

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) {
    return { error: res.result.exceptionDetails.exception?.description ?? 'eval error' }
  }
  return res.result?.result?.value
}

// 1. 模拟上传 3 张图片
const uploadResult = await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas')
    c.width = 900; c.height = 600 + i * 120
    const ctx = c.getContext('2d')
    ctx.fillStyle = ['#f87171', '#60a5fa', '#34d399'][i]
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 90px sans-serif'
    ctx.fillText('IMG' + (i + 1), 60, 160)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
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

// 2. 检查状态
const state = await evaluate(`(() => {
  const lis = document.querySelectorAll('li').length
  const canvas = document.querySelector('canvas')
  let painted = 0, total = 0
  if (canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    const data = ctx.getImageData(0, 0, w, h).data
    total = w * h
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 8) painted++
  }
  const tmplButtons = document.querySelectorAll('button').length
  return { lis, canvasSize: canvas ? canvas.width + 'x' + canvas.height : null, paintedRatio: total ? +(painted / (data_count(total))).toFixed(4) : 0, buttons: tmplButtons, errs: window.__errs || [] }
  function data_count(t) { return Math.ceil(t / 97) }
})()`)

// 3. 打开导出面板
const exportCheck = await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '导出')
  if (!btn) return 'no export button'
  btn.click()
  return 'clicked'
})()`)
await sleep(800)
const dialog = await evaluate(`(() => {
  const el = Array.from(document.querySelectorAll('h3')).find((h) => h.textContent.includes('导出图片'))
  if (!el) return null
  const box = el.closest('div').parentElement
  return box.textContent.replace(/\\s+/g, ' ').slice(0, 200)
})()`)

// 3.5 真实点击下载，验证导出链路
await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('下载图片'))
  if (btn) btn.click()
  return 'ok'
})()`)
await sleep(4000)
const exportMsg = await evaluate(`(() => {
  const p = Array.from(document.querySelectorAll('p')).find((p) => p.textContent.includes('已导出') || p.textContent.includes('失败'))
  return p ? p.textContent : null
})()`)

// 4. 切换长图模式
const longCheck = await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('长图拼接'))
  if (!btn) return 'no mode button'
  btn.click()
  return 'clicked'
})()`)
await sleep(1200)
const longState = await evaluate(`(() => {
  const canvas = document.querySelector('canvas')
  return { size: canvas ? canvas.width + 'x' + canvas.height : null, errs: window.__errs || [] }
})()`)

console.log('上传结果:', uploadResult)
console.log('上传后状态:', JSON.stringify(state))
console.log('导出面板:', exportCheck, '|', dialog)
console.log('导出结果:', exportMsg)
console.log('长图模式:', longCheck, JSON.stringify(longState))
console.log('控制台错误:', JSON.stringify(longState.errs ?? []))
ws.close()
process.exit(0)
