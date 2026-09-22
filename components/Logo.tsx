/**
 * 站点 Logo —— 直接使用 `app/icon.svg`（Next 会把它作为 favicon 输出到 `/icon.svg`）。
 * 静态导出场景下 `next/image` 已全局 unoptimized，这里直接用原生 img 即可。
 */
/** 移动端 30px、PC（≥640）28px */
export default function Logo({ className = 'h-[30px] w-[30px] sm:h-7 sm:w-7' }: { className?: string }) {
  return (
    <img
      src="/icon.svg"
      alt="酷拼图"
      width={30}
      height={30}
      className={className}
      draggable={false}
    />
  )
}
