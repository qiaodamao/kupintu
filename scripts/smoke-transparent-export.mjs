/**
 * 透明背景导出冒烟：验证「导出图片 → 勾选透明背景」后画布真的不带底色。
 *
 * 用法：node scripts/smoke-transparent-export.mjs <base-url> [port]
 *   node scripts/smoke-transparent-export.mjs http://localhost:3222 9333
 *
 * 覆盖：
 *   1. 默认白色背景 + 不勾选 → 底色为白（回归：别把默认导出弄坏）
 *   2. 默认白色背景 + 勾选   → 底色透明（曾经只有把样式背景切成「透明」才生效，属 bug）
 *   3. 勾选 + 图片本身绘制正常（不能整幅全空）
 *   4. JPG 勾选也强制填白（无 alpha 通道）
 *   5. 阴影开启 + 透明：圆角衬底不能把透明 PNG 垫成白底
 */
const base = (process.argv[2] ?? 'http://localhost:3222').replace(/\/$/, '')
const port = process.argv[3] ?? '9333'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: base + '/editor/' })
await sleep(3000)

// 拦截 toBlob，拿到导出用的那块 canvas（导出面板会新建 canvas 再 toBlob）
await evaluate(`(() => {
  window.__cap = null
  const orig = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (cb, ...a) {
    if (this.width > 400) window.__cap = this
    return orig.call(this, cb, ...a)
  }
  return 'hooked'
})()`)

// 上传 2 张不透明图
await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 2; i++) {
    const c = document.createElement('canvas')
    c.width = 800; c.height = 600
    const ctx = c.getContext('2d')
    ctx.fillStyle = ['#f87171', '#60a5fa'][i]
    ctx.fillRect(0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    files.push(new File([blob], 't' + i + '.png', { type: 'image/png' }))
  }
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'uploaded'
})()`)
await sleep(2200)

await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === '导出')
  b.click(); return 'ok'
})()`)
await sleep(700)

const clickText = (txt) =>
  evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('${txt}'))
    if (!b) return 'no:' + '${txt}'
    b.click(); return 'ok'
  })()`)

const SAMPLE = `(() => {
  const c = window.__cap
  if (!c) return { error: 'no canvas' }
  const ctx = c.getContext('2d')
  const pick = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data)
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let opaque = 0, clear = 0, total = 0
  for (let i = 3; i < d.length; i += 4 * 313) { total++; if (d[i] > 250) opaque++; else if (d[i] < 5) clear++ }
  return {
    size: c.width + 'x' + c.height,
    左上: pick(3, 3),
    右下: pick(c.width - 4, c.height - 4),
    不透明占比: +(opaque / total).toFixed(3),
    全透明占比: +(clear / total).toFixed(3),
  }
})()`

const exportAndSample = async () => {
  await clickText('下载图片')
  await sleep(3200)
  return evaluate(SAMPLE)
}

const R = {}
// 1. 不勾选（默认）
R['1_未勾选'] = await exportAndSample()
// 2. 勾选透明背景
await clickText('透明背景')
await sleep(400)
R['2_勾选透明'] = await exportAndSample()

// 4. 切 JPG（勾选仍在，但 JPG 无 alpha → 必须填白）
await clickText('JPG')
await sleep(400)
R['4_JPG'] = await exportAndSample()

// 5. 阴影 + 透明：重开一页，只传一张「中间透明」的 PNG（单格布局），验证圆角衬底不露白
//    注意：生产构建里 window.__store 被剔除，不能靠它清图，直接重载页面
await send('Page.navigate', { url: base + '/editor/' })
await sleep(3000)
await evaluate(`(() => {
  window.__cap = null
  const orig = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (cb, ...a) {
    if (this.width > 400) window.__cap = this
    return orig.call(this, cb, ...a)
  }
  return 'hooked'
})()`)
await evaluate(`(async () => {
  const c = document.createElement('canvas')
  c.width = 800; c.height = 800
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#22c55e'
  ctx.fillRect(0, 0, 200, 200)
  ctx.fillRect(600, 600, 200, 200)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer()
  dt.items.add(new File([blob], 'alpha.png', { type: 'image/png' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})()`)
await sleep(2000)
// 确保阴影是开启的（默认是开，这里按 DOM 状态判断，避免误关）
R['5_阴影开关'] = await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('阴影'))
  if (!b) return 'no shadow switch'
  const knob = b.querySelector('span span')
  const on = !!knob && knob.className.includes('left-[18px]')
  if (!on) b.click()
  return on ? 'already on' : 'turned on'
})()`)
await sleep(500)
await clickText('导出')
await sleep(700)
await clickText('透明背景')
await sleep(400)
R['5_阴影透明'] = await exportAndSample()
R['5_图片中心'] = await evaluate(`(() => {
  const c = window.__cap
  if (!c) return 'no canvas'
  const ctx = c.getContext('2d')
  const pick = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data)
  return { 中心: pick(c.width / 2, c.height / 2), 左上图角: pick(c.width * 0.12, c.height * 0.12) }
})()`)

R['控制台错误'] = await evaluate(`(window.__errs || [])`)

console.log(JSON.stringify(R, null, 2))

const checks = []
const a = (name, ok, detail) => checks.push({ name, ok: !!ok, detail })
const s1 = R['1_未勾选']
a('未勾选时底色为白', s1 && s1.左上?.[3] === 255 && s1.左上?.slice(0, 3).every((v) => v === 255), s1?.左上)
const s2 = R['2_勾选透明']
a('勾选后底色透明', s2 && s2.左上?.[3] === 0 && s2.右下?.[3] === 0, s2?.左上)
a('勾选后图片仍绘制', s2 && s2.不透明占比 > 0.2, s2?.不透明占比)
const s4 = R['4_JPG']
a('JPG 强制填白', s4 && s4.左上?.[3] === 255, s4?.左上)
const s5 = R['5_图片中心']
a('阴影衬底不露白（透明图中心保持透明）', s5 && s5.中心?.[3] === 0, s5?.中心)
a('无控制台错误', (R['控制台错误'] || []).length === 0, R['控制台错误'])

console.log('\n---')
for (const c of checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + '  ' + JSON.stringify(c.detail))
console.log('\n结论:', checks.every((c) => c.ok) ? 'PASS 透明背景导出生效' : 'FAIL')

ws.close()
process.exit(checks.every((c) => c.ok) ? 0 : 1)
