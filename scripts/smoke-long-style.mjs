/**
 * 验证长图拼接模式默认无边距、无圆角，且两种模式各自记住样式。
 * 用法：node scripts/smoke-long-style.mjs [url] [port]
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
  source: `window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message)));`,
})
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await sleep(4000)

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.exception?.description }
  return res.result?.result?.value
}

const click = (text) =>
  evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(${JSON.stringify(text)}))
    if (!btn) return 'no button: ${text}'
    btn.click()
    return 'clicked'
  })()`)

const styleNow = () =>
  evaluate(`(() => {
    const st = window.__store.getState()
    return { mode: st.mode, padding: st.style.padding, radius: st.style.radius, gap: st.style.gap }
  })()`)

const R = {}

// 1. 上传 2 张图
await evaluate(`(async () => {
  const files = []
  for (let i = 0; i < 2; i++) {
    const c = document.createElement('canvas')
    c.width = 900; c.height = 600
    const ctx = c.getContext('2d')
    ctx.fillStyle = ['#ef4444', '#2563eb'][i]
    ctx.fillRect(0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    files.push(new File([blob], 's' + i + '.png', { type: 'image/png' }))
  }
  const input = document.querySelector('input[type=file]')
  const dt = new DataTransfer()
  files.forEach(f => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})()`)
await sleep(2500)

R['1_初始(布局拼图)'] = await styleNow()

// 2. 切到长图拼接
await click('长图拼接')
await sleep(1200)
R['2_长图拼接(默认)'] = await styleNow()

// 2.5 默认状态下检查画布是否贴边（图片外框应紧贴白色画布边缘，仅差 1~2px 抗锯齿）
const edgeCheck = () =>
  evaluate(`(() => {
    const c = document.querySelector('canvas')
    if (!c) return 'no canvas'
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    const isImg = (i) => (d[i] > 180 && d[i+1] < 110 && d[i+2] < 110) || (d[i+2] > 150 && d[i] < 110)
    const isWhite = (i) => d[i] > 240 && d[i+1] > 240 && d[i+2] > 240
    let ix0=1e9, iy0=1e9, ix1=-1, iy1=-1, wx0=1e9, wy0=1e9, wx1=-1, wy1=-1
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4
      if (d[i+3] < 200) continue
      if (isImg(i)) { if(x<ix0)ix0=x; if(y<iy0)iy0=y; if(x>ix1)ix1=x; if(y>iy1)iy1=y }
      else if (isWhite(i)) { if(x<wx0)wx0=x; if(y<wy0)wy0=y; if(x>wx1)wx1=x; if(y>wy1)wy1=y }
    }
    return { imgBox: [ix0,iy0,ix1,iy1], whiteBox: [wx0,wy0,wx1,wy1],
      padLeft: ix0-wx0, padTop: iy0-wy0, padRight: wx1-ix1, padBottom: wy1-iy1 }
  })()`)
R['2.5_默认长图贴边检测'] = await edgeCheck()

// 3. 在长图模式手动改样式
await evaluate(`window.__store.getState().updateStyle({ padding: 24, radius: 18 })`)
await sleep(400)
R['3_长图手动调整后'] = await styleNow()

// 4. 切回布局拼图：应恢复 16/12
await click('布局拼图')
await sleep(1200)
R['4_切回布局拼图'] = await styleNow()

// 5. 再次切长图：应记住 24/18
await click('长图拼接')
await sleep(1200)
R['5_再切长图'] = await styleNow()

// 6. 恢复默认后再测一次贴边（padding=24 时应当出现白边，确认检测有效）
await evaluate(`window.__store.getState().updateStyle({ padding: 24, radius: 18 })`)
await sleep(600)
R['6_加边距后(对照组)'] = await edgeCheck()

R.errors = await evaluate('window.__errs || []')

console.log(JSON.stringify(R, null, 2))
ws.close()
process.exit(0)
