/**
 * PWA 冒烟：manifest / 图标 / Service Worker 注册 / 离线可用性
 * 用法：node scripts/smoke-pwa.mjs [baseUrl] [port]
 *
 * 依赖本机 Chrome 开 --remote-debugging-port（默认 9333）。
 * 离线验证用 CDP 的 Network.emulateNetworkConditions 模拟断网，不需要真的关网络。
 */
const base = (process.argv[2] ?? 'http://localhost:3222/').replace(/\/?$/, '/')
const port = process.argv[3] ?? '9333'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}

// ---------- 1. 静态资源（纯 Node fetch，不走浏览器缓存） ----------
const manifest = await fetch(base + 'manifest.webmanifest').then((r) => {
  R['manifest 状态'] = r.status
  return r.json()
})
R['manifest'] = {
  name: manifest.name,
  short_name: manifest.short_name,
  start_url: manifest.start_url,
  display: manifest.display,
  theme_color: manifest.theme_color,
  icons: manifest.icons?.length,
}
const iconChecks = []
for (const ic of manifest.icons ?? []) {
  const res = await fetch(new URL(ic.src, base))
  iconChecks.push(`${ic.src} ${res.status} ${res.headers.get('content-type')}`)
}
R['图标状态'] = iconChecks
const swRes = await fetch(base + 'sw.js')
R['sw.js'] = `${swRes.status} ${swRes.headers.get('content-type')}`
const offlineRes = await fetch(base + 'offline/')
R['/offline/'] = offlineRes.status

// ---------- 2. 浏览器内验证 SW 注册与离线可用 ----------
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

await send('Page.enable')
await send('Network.enable')
await send('Runtime.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push(String(e.message || e)));
    const __oe = console.error;
    console.error = function (...a) { window.__errs.push('console: ' + a.map(String).join(' ')); __oe.apply(console, a) };
  `,
})
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })

// 首次访问，等待 SW 安装 + 激活
await send('Page.navigate', { url: base })
await sleep(2500)
R['SW 注册'] = await evaluate(`(async () => {
  if (!('serviceWorker' in navigator)) return '不支持 SW'
  const reg = await navigator.serviceWorker.ready
  return { scope: reg.scope, active: !!reg.active, state: reg.active?.state }
})()`)
// 再等缓存写入完成（install 的 addAll 可能仍在进行）
await sleep(1500)
R['缓存条目'] = await evaluate(`(async () => {
  const names = await caches.keys()
  const out = {}
  for (const n of names) out[n] = (await (await caches.open(n)).keys()).length
  return out
})()`)

// 断网 → 重新加载首页（应命中缓存 shell）
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
await send('Page.navigate', { url: base })
await sleep(2000)
R['离线 首页'] = await evaluate(`(() => ({
  title: document.title,
  rootMounted: !!document.querySelector('main, #faq, header, canvas'),
  errs: (window.__errs || []).length,
}))()`)
// 断网 → 编辑器页
await send('Page.navigate', { url: base + 'editor/' })
await sleep(2000)
R['离线 编辑器'] = await evaluate(`(() => ({
  title: document.title,
  rootMounted: !!document.querySelector('canvas'),
}))()`)
// 恢复在线
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

R['控制台错误'] = await evaluate(`window.__errs || []`)
ws.close()

console.log(JSON.stringify(R, null, 2))

// ---------- 3. 断言 ----------
const checks = []
const a = (name, ok, detail) => checks.push({ name, ok: !!ok, detail })
a('manifest 200', R['manifest 状态'] === 200, R['manifest 状态'])
a('manifest 字段齐全', !!manifest.name && !!manifest.short_name && manifest.display === 'standalone' && manifest.start_url === '/', R.manifest)
a(
  'manifest 图标 3 个且全部 200',
  (manifest.icons?.length ?? 0) === 3 && iconChecks.every((s) => s.includes(' 200 image/png')),
  iconChecks,
)
a('sw.js 可访问', String(R['sw.js']).startsWith('200'), R['sw.js'])
a('/offline/ 页面 200', R['/offline/'] === 200, R['/offline/'])
const sw = R['SW 注册']
a('SW 激活', sw && sw.active === true && sw.state === 'activated', sw)
const cacheOk = Object.values(R['缓存条目'] || {}).some((n) => n >= 3)
a('预缓存 ≥3 个 shell 资源', cacheOk, R['缓存条目'])
const home = R['离线 首页']
a('断网后首页可打开（缓存 shell）', home && typeof home.title === 'string' && home.title.includes('拼图') && home.rootMounted, home)
const ed = R['离线 编辑器']
a('断网后编辑器可打开', ed && ed.rootMounted, ed)
a('零控制台错误', (R['控制台错误'] || []).length === 0, R['控制台错误'])

console.log('\n---')
for (const c of checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name)
console.log('\n结论:', checks.every((c) => c.ok) ? 'PASS PWA 全部生效' : 'FAIL')
process.exit(checks.every((c) => c.ok) ? 0 : 1)
