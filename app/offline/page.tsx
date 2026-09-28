import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '离线 - 酷拼图',
  robots: { index: false, follow: false },
}

/** PWA 离线回退页：断网且无缓存副本时由 Service Worker 返回 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <div className="flex gap-2">
        <span className="h-8 w-8 rounded-full bg-primary" />
        <span className="h-8 w-8 rounded-full bg-primary/70" />
        <span className="h-8 w-8 rounded-full bg-primary/50" />
        <span className="h-8 w-8 rounded-full bg-primary/30" />
      </div>
      <h1 className="text-lg font-bold text-ink-deep">当前处于离线状态</h1>
      <p className="max-w-sm text-sm leading-relaxed text-steel">
        酷拼图的所有处理都在浏览器本地完成，网络恢复后刷新即可继续使用。已访问过的页面离线时仍可打开。
      </p>
      <Link
        href="/"
        className="text-button rounded-full bg-primary px-[30px] py-[14px] text-on-primary transition-colors active:bg-primary-deep"
      >
        返回首页
      </Link>
    </main>
  )
}
