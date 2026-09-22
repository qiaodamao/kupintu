'use client'

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: BtnProps) {
  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
  }[size]
  const variants = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25 disabled:opacity-50',
    secondary:
      'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700',
    ghost:
      'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    danger:
      'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300',
  }[variant]
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50',
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
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
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
    <div
      className={cn(
        'inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            // h-7 固定高度：否则「图标选项」比「文字选项」矮 2px，相邻两组分段控件看起来一大一小
            'flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-xs font-medium transition-colors',
            value === o.value
              ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
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
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between text-xs text-slate-600 dark:text-slate-300"
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600',
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

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
        props.className,
      )}
    />
  )
}

const SWATCHES = ['#ffffff', '#000000', '#f8fafc', '#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#e0e7ff', '#fae8ff', '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

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
              'h-6 w-6 rounded-md border transition-transform hover:scale-110',
              value === c ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200 dark:border-slate-700',
            )}
            style={{ background: c }}
          />
        ))}
        {allowTransparent ? (
          <button
            onClick={() => onChange(null)}
            title="透明"
            className={cn(
              'checkerboard h-6 w-6 rounded-md border transition-transform hover:scale-110',
              value === null ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200',
            )}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
        />
        <TextInput value={value ?? 'transparent'} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

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
    <section className="border-b border-slate-200 px-4 py-4 last:border-b-0 dark:border-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {icon}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  )
}
