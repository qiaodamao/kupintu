/**
 * 站点 Logo —— 直接使用 `app/icon.svg`（Next 会把它作为 favicon 输出到 `/icon.svg`）。
 * 静态导出场景下 `next/image` 已全局 unoptimized，这里直接用原生 img 即可。
 */
export default function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <img
      src="/icon.svg"
      alt="酷拼图"
      width={24}
      height={24}
      className={className}
      draggable={false}
    />
  )
}
