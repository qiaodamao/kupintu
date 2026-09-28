'use client'

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'commerce' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Meta 体系按钮：一律药丸（rounded-full），排印 button-md（14/700/-0.14px）。
 * - primary  = 营销面黑药丸（{colors.ink-button}）
 * - commerce = 工具/购买流 cobalt 药丸（{colors.primary}），本编辑器属工具面
 * - secondary= 描边药丸；ghost = 淡描边药丸
 */
export function Button({ variant = 'secondary', size = 'md', className, ...rest }: BtnProps) {
  const sizes = {
    sm: 'py-1.5 px-4',
    md: 'py-2.5 px-5',
    lg: 'py-3 px-7 text-[15px]',
  }[size]
  const variants = {
    primary:
      'bg-ink-button text-on-ink-button active:bg-charcoal disabled:bg-disabled disabled:text-canvas',
    commerce:
      'bg-primary text-on-primary active:bg-primary-deep disabled:bg-disabled disabled:text-canvas',
    secondary:
      'bg-transparent text-ink-deep border-2 border-ink-deep active:bg-surface-soft',
    ghost:
      'bg-transparent text-ink-deep border-2 border-ink-deep/10 active:bg-surface-soft',
  }[variant]
  return (
    <button
      className={cn(
        'text-button inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full select-none transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        sizes,
        variants,
        className,
      )}
      {...rest}
    />
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-charcoal">{label}</span>
        <span className="font-mono text-[11px] text-steel">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="w-full cursor-pointer"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

/**
 * 顶栏/面板的分类药丸 tab（button-pill-tab）：
 * 未选中 = 白底 + hairline 描边药丸；选中 = ink-deep 实底药丸（无边框）。
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode; title?: string }>
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex shrink-0 items-center gap-1.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            // h-7 固定高度：否则「图标选项」比「文字选项」矮 2px，相邻两组分段控件看起来一大一小
            // flex-1：外层传 w-full 时各组药丸等宽铺满（面板内整行场景）
            // 选中/未选中都留 1px 描边（选中态描边透明）：否则点一下兄弟药丸会宽窄跳 2px
            'flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border px-3 text-xs font-bold tracking-[-0.14px] transition-colors',
            value === o.value
              ? 'chip-accent border-transparent'
              : 'border-hairline bg-canvas text-ink hover:border-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}
) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink">{label}</span>
        {hint ? <span className="text-[11px] text-steel">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

/** 选中态走 Facebook Blue（{colors.fb-blue} 为表单控件激活色） */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => (disabled ? undefined : onChange(!checked))}
      className={cn(
        'flex w-full items-center justify-between text-xs text-charcoal',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-fb-blue' : 'bg-hairline',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all shadow-sm',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

/** text-input：8px 圆角 + hairline 描边，聚焦 2px fb-blue */
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-lg border border-hairline bg-canvas px-3 text-sm text-ink outline-none transition-colors placeholder:text-stone focus:border-fb-blue',
        props.className,
      )}
    />
  )
}

const SWATCHES = ['#ffffff', '#000000', '#f1f4f7', '#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#e0e7ff', '#fae8ff', '#0064e0', '#e41e3f', '#f7b928', '#31a24c', '#1876f2', '#a121ce', '#ec4899']

/** color-swatch-circle：32px 正圆，选中态白色环 */
export function ColorPicker({
  value,
  onChange,
  allowTransparent,
}: {
  value: string | null
  onChange: (v: string | null) => void
  allowTransparent?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              'h-7 w-7 rounded-full border border-hairline transition-transform hover:scale-110',
              value === c && 'ring-2 ring-canvas shadow-[0_0_0_2px_var(--color-primary)]',
            )}
            style={{ background: c }}
          />
        ))}
        {allowTransparent ? (
          <button
            onClick={() => onChange(null)}
            title="透明"
            className={cn(
              'checkerboard h-7 w-7 rounded-full border border-hairline transition-transform hover:scale-110',
              value === null && 'ring-2 ring-canvas shadow-[0_0_0_2px_var(--color-primary)]',
            )}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-lg border border-hairline bg-canvas p-0.5"
        />
        <TextInput value={value ?? 'transparent'} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

/** 面板分节：hairline-soft 分隔线 + body-sm-bold 标题（与按钮/药丸同一排印） */
export function Section({
  title,
  icon,
  children,
  right,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <section className="border-b border-hairline-soft px-5 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.14px] text-ink">
          {icon}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  )
}
