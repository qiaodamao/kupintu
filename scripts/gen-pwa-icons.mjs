/**
 * 由站点 logo（app/icon.svg 的配色与几何）生成 PWA / iOS 需要的 PNG 图标：
 *   public/icon-192.png           192×192   manifest（any）
 *   public/icon-512.png           512×512   manifest（any）
 *   public/icon-maskable-512.png  512×512   manifest（maskable，内容缩进到安全区）
 *   public/apple-touch-icon.png   180×180   iOS 添加到主屏幕
 *
 * 为什么不用圆角 logo 原图：iOS / Android 会再叠一层圆角（甚至圆形）遮罩，
 * 直接放带圆角的图会出现「圆角里的圆角」；maskable 还会裁掉超出中心安全圆的部分。
 * 所以统一做成：满幅渐变底 + 拼图块居中（maskable 额外缩到 70%）。
 *
 * 依赖本机 Chrome 开 --remote-debugging-port（默认 9333）。
 * 用法：node scripts/gen-pwa-icons.mjs [port]
 */
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = process.argv[2] ?? '9333'
// 走 fileURLToPath，中文路径用 URL.pathname 会留下 %E4%B9%94 这类转义
const root = fileURLToPath(new URL('..', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** logo 几何按 32 视口等比放大：外框满幅、白块 margin 6.5/32、块 8/32、rx 2/32 */
function svg(size, { scale = 1 } = {}) {
  const s = (v) => +(v * (size / 32) * scale).toFixed(2)
  const block = s(8)
  const margin = s(6.5)
  const gap = s(3)
  const rx = s(2)
  const inner = block * 2 + gap
  const offset = +((size - inner) / 2).toFixed(2)
  // 用 margin 定位会让 maskable 缩放后不居中，这里按内容块整体居中
  const x1 = offset
  const x2 = +(offset + block + gap).toFixed(2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1" />
      <stop offset="1" stop-color="#d946ef" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)" />
  <rect x="${x1}" y="${x1}" width="${block}" height="${block}" rx="${rx}" fill="#ffffff" opacity="0.95" />
  <rect x="${x2}" y="${x1}" width="${block}" height="${block}" rx="${rx}" fill="#ffffff" opacity="0.7" />
  <rect x="${x1}" y="${x2}" width="${block}" height="${block}" rx="${rx}" fill="#ffffff" opacity="0.7" />
  <rect x="${x2}" y="${x2}" width="${block}" height="${block}" rx="${rx}" fill="#ffffff" opacity="0.95" />
</svg>`
}

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) throw new Error('未找到 Chrome 页面，先启动 --remote-debugging-port=' + port)
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
await send('Page.enable')

const tmp = join(tmpdir(), 'kupintu-icon.svg')
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.7 }, // 缩进到 maskable 安全区
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
]

for (const t of targets) {
  writeFileSync(tmp, svg(t.size, { scale: t.scale }), 'utf8')
  await send('Emulation.setDeviceMetricsOverride', {
    width: t.size,
    height: t.size,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') })
  await sleep(900)
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: t.size, height: t.size, scale: 1 },
    captureBeyondViewport: true,
  })
  const buf = Buffer.from(shot.result.data, 'base64')
  const out = join(root, 'public', t.file)
  writeFileSync(out, buf)
  console.log(t.file.padEnd(24), t.size + 'x' + t.size, buf.length + 'B', buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20))
}

rmSync(tmp, { force: true })
ws.close()
process.exit(0)
