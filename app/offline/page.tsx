import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '离线 - 酷拼图',
  robots: { index: false, follow: false },
}

/** PWA 离线回退页：断网且无缓存副本时由 Service Worker 返回 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-950">
      <div className="flex gap-2">
        <span className="h-8 w-8 rounded-lg bg-brand-500" />
        <span className="h-8 w-8 rounded-lg bg-brand-400/70" />
        <span className="h-8 w-8 rounded-lg bg-brand-300/70" />
        <span className="h-8 w-8 rounded-lg bg-brand-200/90" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">当前处于离线状态</h1>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        酷拼图的所有处理都在浏览器本地完成，网络恢复后刷新即可继续使用。已访问过的页面离线时仍可打开。
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        返回首页
      </Link>
    </main>
  )
}
