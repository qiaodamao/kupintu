/**
 * smoke-mode-switch.mjs —— 布局拼图 ⇄ 长图拼接 往返切换后图片仍在
 *
 * 背景 bug：长图模式的 placements 以「图片 id」为键，网格模式要「叶子 id」，
 * 切回布局时若不按布局树重建 placements，键名错位导致整块空白（图片数组其实没丢）。
 *
 * 用法：node scripts/smoke-mode-switch.mjs <url> <cdp-port>
 */
const base = (process.argv[2] ?? 'http://localhost:3222').replace(/\/$/, '')
const port = process.argv[3] ?? '9333'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const errs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errs.push(String(m.params.args?.[0]?.value ?? '').slice(0, 120))
  }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text)
  return r.result?.result?.value
}
const mouse = async (type, x, y, clicks = 1) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: clicks })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clickBox = async (x, y) => {
  await mouse('mousePressed', x, y)
  await mouse('mouseReleased', x, y)
}

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: base + '/editor/' })
await sleep(2500)
await evaluate(`window.__errs = []`)
await evaluate(`addEventListener('error', (e) => window.__errs.push(String(e.message)))`)

const R = {}
let failed = 0
const check = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
}

// 上传 3 张高饱和纯色图，方便用「canvas 上的颜色种类」判断图片到底画出来没有
R['上传'] = await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas')
    c.width = 900; c.height = 600 + i * 120
    const ctx = c.getContext('2d')
    ctx.fillStyle = ['#f87171', '#60a5fa', '#34d399'][i]
    ctx.fillRect(0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    files.push(new File([blob], 'mode' + i + '.png', { type: 'image/png' }))
  }
  const input = document.querySelector('input[type=file]')
  if (!input) return 'no input'
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})()`)
await sleep(2600)

/** 统计 canvas 上出现的主色（取样去重），用于判断图片是否被真正绘制 */
const COLOR_PROBE = `(() => {
  const canvas = document.querySelector('canvas')
  if (!canvas) return 'no canvas'
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const d = ctx.getImageData(0, 0, w, h).data
  const hit = new Set()
  const KEY = { '248,113,113': '红', '96,165,250': '蓝', '52,211,153': '绿' }
  for (let i = 0; i < d.length; i += 4 * 53) {
    const k = KEY[d[i] + ',' + d[i + 1] + ',' + d[i + 2]]
    if (k) hit.add(k)
  }
  const thumbs = document.querySelectorAll('[data-thumb], li img, aside img').length
  return { 主色: [...hit].sort().join(''), 缩略图: thumbs }
})()`

const clickMode = async (title) => {
  const box = await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.title === '${title}' || x.textContent.includes('${title}'))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (!box) return 'no button ' + title
  await clickBox(box.x, box.y)
  await sleep(1400)
  return 'clicked'
}

R['初始·布局拼图'] = await evaluate(COLOR_PROBE)
check(R['初始·布局拼图'].主色 === '红绿蓝', '网格模式 3 张图已绘制', R['初始·布局拼图'].主色)

R['切到长图'] = await clickMode('长图拼接')
R['长图模式'] = await evaluate(COLOR_PROBE)
check(R['长图模式'].主色 === '红绿蓝', '切到长图拼接后 3 张图仍在', R['长图模式'].主色)

R['切回布局'] = await clickMode('布局拼图')
R['回到布局'] = await evaluate(COLOR_PROBE)
check(R['回到布局'].主色 === '红绿蓝', '切回布局拼图后 3 张图仍在（本次修复点）', R['回到布局'].主色)

// 再往返一轮，确认 tree / placements 不会在二次切换时又被冲掉
await clickMode('长图拼接')
await clickMode('布局拼图')
R['二次往返'] = await evaluate(COLOR_PROBE)
check(R['二次往返'].主色 === '红绿蓝', '二次往返后仍然正常', R['二次往返'].主色)

R['控制台错误'] = await evaluate(`window.__errs || []`).catch(() => [])
check((R['控制台错误'].length ?? 0) === 0 && errs.length === 0, '零控制台错误', JSON.stringify([...R['控制台错误'], ...errs]))

console.log('\n结论:', failed === 0 ? 'PASS 模式往返切换图片不丢失' : `FAIL ${failed} 项`)
ws.close()
process.exit(failed === 0 ? 0 : 1)
