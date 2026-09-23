/**
 * 酷拼图 Service Worker（配合静态导出 output: 'export'，由 EdgeOne Pages 提供 HTTPS）
 *
 * 缓存策略：
 *   - 安装时预缓存 app shell（'/'、'/editor/'、'/offline/'）
 *   - 带内容 hash 的静态资源（/_next/static/…）→ cache-first（URL 永不变，可放心缓存）
 *   - 页面导航 → network-first（保证用户总能拿到最新版），失败回退已缓存副本，再回退 /offline/
 *   - 其它同源 GET → stale-while-revalidate
 *
 * 更新机制：新 SW 安装成功后 skipWaiting + clients.claim 立即接管；旧版本缓存
 * 在 activate 时按版本号清理。页面刷新后即用新资源。
 */
const VERSION = 'v1'
const SHELL_CACHE = `shell-${VERSION}`
const RUNTIME_CACHE = `runtime-${VERSION}`
const SHELL_URLS = ['/', '/editor/', '/offline/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 页面导航：network-first，离线时回退缓存副本 / 离线提示页
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(async () =>
          (await caches.match(req)) ?? (await caches.match('/offline/')) ?? Response.error(),
        ),
    )
    return
  }

  // 带内容 hash 的静态资源：cache-first
  if (url.pathname.startsWith('/_next/static/') || /\.(png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
    return
  }

  // 其它同源 GET：stale-while-revalidate
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => hit)
      return hit ?? network
    }),
  )
})
