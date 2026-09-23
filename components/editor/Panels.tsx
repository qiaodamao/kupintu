'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Background, ImageAsset, LongDirection, StyleConfig } from '@/lib/types'
import { MAX_IMAGES, MAX_LONG_COLS, useEditor } from '@/lib/store'
import { computeRects, countLeaves, genTemplates } from '@/lib/layout'
import type { LayoutNode } from '@/lib/types'
import { longLayout } from '@/lib/render'
import type { DrawOptions } from '@/lib/render'
import { downloadBlob, renderToBlob, stamp, targetWidth } from '@/lib/export'
import type { ExportFormat, ScaleMode } from '@/lib/export'
import { Button, ColorPicker, Field, Section, Segmented, Slider, Switch, TextInput, cn } from '@/components/ui'
import {
  IconArrow,
  IconCircle,
  IconDownload,
  IconGrid,
  IconHand,
  IconImage,
  IconLayers,
  IconLong,
  IconMoon,
  IconPalette,
  IconRedo,
  IconSliders,
  IconSparkles,
  IconSquare,
  IconSun,
  IconText,
  IconTrash,
  IconUndo,
  IconUpload,
  IconX,
} from '@/components/Icons'
import Logo from '@/components/Logo'

/* ------------------------------ 顶栏 ------------------------------ */

export function TopBar({ onExport }: { onExport: () => void }) {
  const mode = useEditor((s) => s.mode)
  const tool = useEditor((s) => s.tool)
  const longDir = useEditor((s) => s.longDir)
  const setMode = useEditor((s) => s.setMode)
  const setTool = useEditor((s) => s.setTool)
  const setLongDir = useEditor((s) => s.setLongDir)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.history.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), [])

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('kupintu-theme', next ? 'dark' : 'light')
    setDark(next)
  }

  const tools = [
    { value: 'select' as const, label: <IconHand className="h-4 w-4" />, title: '选择 / 拖拽' },
    { value: 'text' as const, label: <IconText />, title: '文字' },
    { value: 'arrow' as const, label: <IconArrow />, title: '箭头' },
    { value: 'rect' as const, label: <IconSquare />, title: '方框' },
    { value: 'ellipse' as const, label: <IconCircle />, title: '圆圈' },
  ]

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      {/* 通栏显示（不居中），内边距与首页一致：px-3 / sm:px-4；
          320 一类超窄屏放不下，单独收紧兜底防裁切 */}
      <div className="flex h-14 items-center gap-1.5 px-3 max-[359px]:gap-0.5 max-[359px]:px-2 sm:gap-2 sm:px-4">
        {/* 窄屏下 logo 与模式切换挨得太近，额外补一点间距（宽屏保持原样） */}
        <a href="/" className="flex shrink-0 items-center gap-2 mr-2.5 max-[359px]:mr-1 sm:mr-2" title="酷拼图">
          <Logo className="h-[30px] w-[30px] shrink-0 rounded-lg sm:h-7 sm:w-7" />
          <span className="hidden text-[15px] font-semibold tracking-tight text-slate-900 sm:block dark:text-white">
            酷拼图
          </span>
        </a>

        {/* 窄屏只显示图标，文字用 title 兜底 */}
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'grid',
              title: '布局拼图',
              label: (
                <span className="flex items-center gap-1">
                  <IconGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">布局拼图</span>
                </span>
              ),
            },
            {
              value: 'long',
              title: '长图拼接',
              label: (
                <span className="flex items-center gap-1">
                  <IconLong className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">长图拼接</span>
                </span>
              ),
            },
          ]}
        />

        {mode === 'long' ? (
          <Segmented
            value={longDir}
            onChange={setLongDir}
            options={[
              {
                value: 'vertical',
                title: '竖向拼接',
                // 单字外面套与图标同尺寸的方框，窄屏下宽度才能和「布局 / 长图」那组完全一致
                label: (
                  <span className="flex items-center gap-1">
                    <span className="grid h-3.5 w-3.5 place-items-center text-xs leading-none">竖</span>
                    <span className="hidden sm:inline">向</span>
                  </span>
                ),
              },
              {
                value: 'horizontal',
                title: '横向拼接',
                label: (
                  <span className="flex items-center gap-1">
                    <span className="grid h-3.5 w-3.5 place-items-center text-xs leading-none">横</span>
                    <span className="hidden sm:inline">向</span>
                  </span>
                ),
              },
            ]}
          />
        ) : null}

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-slate-200 lg:block dark:bg-slate-700" />
        {/* 绘制工具在窄屏由画布下方的 MobileTools 承担；这里用外层容器控制显隐
            （Segmented / Button 自身带 inline-flex，直接传 hidden 会被它覆盖） */}
        <div className="hidden shrink-0 lg:block">
          <Segmented value={tool} onChange={setTool} options={tools} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 lg:gap-1.5">
          <span className="hidden sm:inline-flex">
            <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo} title="撤销 Ctrl+Z" aria-label="撤销">
              <IconUndo className="h-4 w-4" />
            </Button>
          </span>
          <span className="hidden sm:inline-flex">
            <Button size="sm" variant="ghost" onClick={redo} disabled={!canRedo} title="重做 Ctrl+Shift+Z" aria-label="重做">
              <IconRedo className="h-4 w-4" />
            </Button>
          </span>
          <Button size="sm" variant="ghost" onClick={toggleTheme} title="切换主题" aria-label="切换主题">
            {dark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="primary" onClick={onExport} className="px-2 sm:px-3">
            <IconDownload className="h-4 w-4" />
            导出
          </Button>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------ 左：图片 ------------------------------ */

/**
 * 排序拖拽时每项的纵向位移：
 * - 被拖的那张直接滑到落点位置（target = slot > from ? slot - 1 : slot）
 * - 顺移方向上的其它项整体让开一格，于是落点处自然空出一条缝
 * 全部用 transform，不触发重排，拖起来很顺。
 */
function dragOffset(i: number, from: number, slot: number, step: number): number {
  if (i === from) {
    const target = slot > from ? slot - 1 : slot
    return (target - from) * step
  }
  if (slot > from && i > from && i <= slot - 1) return -step
  if (slot < from && i >= slot && i < from) return step
  return 0
}

export function ImagePanel({ onPick }: { onPick: (files: File[]) => void }) {
  const images = useEditor((s) => s.images)
  const mode = useEditor((s) => s.mode)
  const removeImage = useEditor((s) => s.removeImage)
  const clearImages = useEditor((s) => s.clearImages)
  const reorderImages = useEditor((s) => s.reorderImages)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // 拖动开始时快照每项的原始位置：之后换算插入位置必须用未位移的坐标，
  // 否则元素一让开，命中判定又跟着变，会出现来回抖动。
  const dragGeo = useRef<{ from: number; tops: number[]; heights: number[]; scrollTop: number } | null>(null)
  const [dragView, setDragView] = useState<{ from: number; slot: number; step: number } | null>(null)

  // 只负责收集文件并交给父组件，避免与 onPick 重复添加
  const pick = (files: FileList | null) => {
    if (!files?.length) return
    onPick(Array.from(files))
  }

  const beginDrag = (e: React.DragEvent<HTMLLIElement>, i: number, id: string) => {
    const items = listRef.current?.querySelectorAll('li')
    const tops: number[] = []
    const heights: number[] = []
    let step = 0
    items?.forEach((el, k) => {
      const r = el.getBoundingClientRect()
      tops.push(r.top)
      heights.push(r.height)
      if (k === 1) step = r.top - (items[0]?.getBoundingClientRect().top ?? 0)
    })
    dragGeo.current = { from: i, tops, heights, scrollTop: listRef.current?.scrollTop ?? 0 }
    setDragView({ from: i, slot: i, step: step || 60 })
    e.dataTransfer.setData('application/x-kupintu-image', id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  /** 光标纵坐标 → 插入槽位（0..n，n 表示放到最后） */
  const slotAt = (clientY: number): number => {
    const g = dragGeo.current
    if (!g) return 0
    const scrolled = (listRef.current?.scrollTop ?? 0) - g.scrollTop
    for (let k = 0; k < g.tops.length; k++) {
      const top = g.tops[k] - scrolled
      if (clientY < top + g.heights[k] / 2) return k
    }
    return g.tops.length
  }

  const endDrag = () => {
    dragGeo.current = null
    setDragView(null)
  }

  const moveTo = (slot: number) => {
    const g = dragGeo.current
    if (!g) return
    const from = g.from
    const to = slot > from ? slot - 1 : slot
    if (to !== from && to >= 0 && to < images.length) reorderImages(from, to)
    endDrag()
  }

  return (
    <div className="flex h-full flex-col">
      <Section title="图片素材" icon={<IconImage className="h-3.5 w-3.5 text-brand-500" />}>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            // 从素材列表拖进来的（自带图片 id，且浏览器会附一份 file），不能再当新文件上传
            if (e.dataTransfer.getData('application/x-kupintu-image')) return
            pick(e.dataTransfer.files)
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800/40"
        >
          <IconUpload className="mb-2 h-6 w-6 text-brand-500" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">点击或拖拽上传图片</p>
          <p className="mt-1 text-[11px] text-slate-400">支持 JPG / PNG / WebP · 最多 {MAX_IMAGES} 张</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />
      </Section>

      <Section
        title={`已上传 ${images.length}`}
        icon={<IconLayers className="h-3.5 w-3.5 text-brand-500" />}
        right={
          images.length ? (
            <button onClick={clearImages} className="text-[11px] text-slate-400 hover:text-rose-500">
              清空
            </button>
          ) : null
        }
      >
        {images.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">还没有图片，先上传几张吧</p>
        ) : (
          <ul
            ref={listRef}
            className="scroll-thin max-h-[42vh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-none lg:flex-1"
            onDragOver={(e) => {
              if (!dragGeo.current) {
                // 外部文件拖到列表上：只阻止浏览器默认打开，交给上面的上传区处理
                if (e.dataTransfer.types.includes('Files')) e.preventDefault()
                return
              }
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const slot = slotAt(e.clientY)
              setDragView((d) => (d && d.slot !== slot ? { ...d, slot } : d))
            }}
            onDrop={(e) => {
              if (!dragGeo.current) {
                e.preventDefault()
                return
              }
              e.preventDefault()
              moveTo(slotAt(e.clientY))
            }}
          >
            {images.map((img, i) => {
              const offset = dragView ? dragOffset(i, dragView.from, dragView.slot, dragView.step) : 0
              const dragging = dragView?.from === i
              return (
              <li
                key={img.id}
                draggable
                onDragStart={(e) => beginDrag(e, i, img.id)}
                onDragEnd={endDrag}
                style={{
                  transform: offset ? `translateY(${offset}px)` : undefined,
                  // 让开的项与被拖的项同步位移，视觉上就是「中间撑开一条缝」
                  transition:
                    'transform 160ms cubic-bezier(0.2, 0, 0, 1), box-shadow 160ms, border-color 160ms',
                  zIndex: dragging ? 20 : undefined,
                }}
                className={cn(
                  'group relative flex cursor-grab items-center gap-2 rounded-lg border p-1.5 active:cursor-grabbing',
                  dragging
                    ? 'border-brand-400 bg-white shadow-lg ring-2 ring-brand-300 dark:border-brand-500 dark:bg-slate-800'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
                )}
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-slate-400">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-slate-700 dark:text-slate-200">{img.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {img.width}×{img.height}
                  </p>
                </div>
                <button
                  onClick={() => removeImage(img.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"
                  title="移除"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </li>
              )
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          拖动缩略图排序，中间的图会自动让开
          {mode === 'long' ? '；也可直接拖到画布上，放到拼接条里的指定位置。' : '；拖到画布上的格子即可替换图片。'}
        </p>
      </Section>
    </div>
  )
}

/* ------------------------------ 右：样式 ------------------------------ */

const RATIOS = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 0.8 },
  { label: '3:4', value: 0.75 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 1.5 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
]

/* --------------------- 长图拼接：布局模板 --------------------- */

const LONG_GROUPS: Array<{ dir: LongDirection; label: string; hint: string }> = [
  { dir: 'vertical', label: '竖向拼接', hint: '每排 N 张 · 逐排向下延伸' },
  { dir: 'horizontal', label: '横向拼接', hint: '每列 N 张 · 逐列向右延伸' },
]

const LONG_COLS = Array.from({ length: MAX_LONG_COLS }, (_, i) => i + 1)

function FlowArrow({ dir }: { dir: LongDirection }) {
  return dir === 'vertical' ? (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4 L12 20" />
      <path d="M7 15 L12 20 L17 15" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12 L20 12" />
      <path d="M15 7 L20 12 L15 17" />
    </svg>
  )
}

/** 缩略预览：竖向画 N 列 × 2 排，横向画 2 列 × N 排，一眼看出排布方向 */
function LongTemplatePreview({ dir, cols, active }: { dir: LongDirection; cols: number; active: boolean }) {
  // 列数多时把辅助方向压到 1 格、间距收窄，否则小方块会挤成一条看不清
  const cross = cols >= 5 ? 1 : 2
  const c = dir === 'vertical' ? cols : cross
  const r = dir === 'vertical' ? cross : cols
  return (
    <span
      className={cn(
        'grid h-9 w-full rounded-[3px] p-[2px]',
        cols >= 5 ? 'gap-[1px]' : 'gap-[2px]',
        active ? 'bg-brand-100 dark:bg-brand-950' : 'bg-slate-100 dark:bg-slate-700',
      )}
      style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${r}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: c * r }, (_, i) => (
        <span
          key={i}
          className={cn('rounded-[1px]', active ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-500')}
        />
      ))}
    </span>
  )
}

const GRADIENTS: Array<[string, string]> = [
  ['#a78bfa', '#f472b6'],
  ['#60a5fa', '#a78bfa'],
  ['#fde047', '#fb923c'],
  ['#34d399', '#60a5fa'],
  ['#fca5a5', '#fda4af'],
  ['#1e293b', '#475569'],
]

function TemplatePreview({ tree, ratio }: { tree: LayoutNode; ratio: number }) {
  const rects = useMemo(() => Array.from(computeRects(tree, { x: 0, y: 0, w: 100, h: 100 }, 2.5).values()), [tree])
  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-700"
      style={{ aspectRatio: String(ratio) }}
    >
      {rects.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-[1.5px] bg-slate-300 dark:bg-slate-500"
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
        />
      ))}
    </div>
  )
}

export function StylePanel() {
  const mode = useEditor((s) => s.mode)
  const style = useEditor((s) => s.style)
  const tree = useEditor((s) => s.tree)
  const images = useEditor((s) => s.images)
  const longDir = useEditor((s) => s.longDir)
  const longCols = useEditor((s) => s.longCols)
  const longMasonry = useEditor((s) => s.longMasonry)
  const setLongLayout = useEditor((s) => s.setLongLayout)
  const setLongMasonry = useEditor((s) => s.setLongMasonry)
  const updateStyle = useEditor((s) => s.updateStyle)
  const applyTemplate = useEditor((s) => s.applyTemplate)
  const ensureTemplate = useEditor((s) => s.ensureTemplate)
  const resetTransforms = useEditor((s) => s.resetTransforms)
  // 以当前画布格子数为准：手动点数字改布局后，高亮和模板列表要跟着变
  const count = Math.max(1, Math.min(MAX_IMAGES, countLeaves(tree)))
  const templates = useMemo(() => genTemplates(count), [count])

  const setBg = (patch: Partial<Background>) => updateStyle({ background: { ...style.background, ...patch } })

  return (
    <div>
      {mode === 'grid' ? (
        <Section title="布局模板" icon={<IconGrid className="h-3.5 w-3.5 text-brand-500" />}>
          {/* 1~30 排成 6 列网格（5 行）：横向滚动条被隐藏后必须换行才能全部看到 */}
          <div className="mb-3 grid grid-cols-6 gap-1">
            {Array.from({ length: MAX_IMAGES }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => ensureTemplate(n)}
                disabled={n > images.length && images.length > 0}
                className={cn(
                  'h-7 w-full rounded-md text-[11px] font-medium transition',
                  n === count
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="scroll-thin grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.tree)}
                className="rounded-lg border border-slate-200 p-1.5 text-left transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <TemplatePreview tree={t.tree} ratio={style.aspect} />
                <span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-slate-400">{t.name}</span>
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={resetTransforms}>
            <IconSparkles className="h-3.5 w-3.5" />
            重置图片缩放与偏移
          </Button>
        </Section>
      ) : (
        <Section title="布局模板" icon={<IconLong className="h-3.5 w-3.5 text-brand-500" />}>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            按左侧图片顺序依次拼接，拖动缩略图即可调整顺序；画布尺寸自动计算，不受比例限制。
          </p>
          <div className="space-y-3">
            {LONG_GROUPS.map((g) => (
              <div key={g.dir}>
                <div className="mb-1.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                    <FlowArrow dir={g.dir} />
                    {g.label}
                  </span>
                  <span className="text-slate-400">· {g.hint}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {LONG_COLS.map((n) => {
                    const active = longDir === g.dir && longCols === n
                    return (
                      <button
                        key={n}
                        onClick={() => setLongLayout(g.dir, n)}
                        title={`${g.label} · ${g.dir === 'vertical' ? `每排 ${n} 张` : `每列 ${n} 张`}`}
                        className={cn(
                          'rounded-md border p-1 transition',
                          active
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60'
                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800',
                        )}
                      >
                        <LongTemplatePreview dir={g.dir} cols={n} active={active} />
                        <span
                          className={cn(
                            'mt-1 block text-center text-[10px]',
                            active ? 'font-medium text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400',
                          )}
                        >
                          {n} 列
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <Switch
              label="瀑布流排列"
              checked={longMasonry}
              onChange={setLongMasonry}
              disabled={longCols <= 1}
            />
            <p className="text-[11px] leading-relaxed text-slate-400">
              {longCols <= 1
                ? '单列 / 单行时排列方式相同，选择 2 列及以上可用。'
                : '开启后每张图自动填入当前最短的一列（竖向）/ 一行（横向），图与图之间的间距保持一致；关闭则按排 / 列对齐居中。'}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="mt-3 w-full" onClick={resetTransforms}>
            <IconSparkles className="h-3.5 w-3.5" />
            重置图片缩放与偏移
          </Button>
        </Section>
      )}

      {mode === 'grid' ? (
        <Section title="画布比例" icon={<IconSliders className="h-3.5 w-3.5 text-brand-500" />}>
          <div className="grid grid-cols-4 gap-1.5">
            {RATIOS.map((r) => (
              <button
                key={r.label}
                onClick={() => updateStyle({ aspect: r.value })}
                className={cn(
                  'h-8 rounded-md border text-[11px] font-medium transition',
                  Math.abs(style.aspect - r.value) < 0.001
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="间距与圆角" icon={<IconSliders className="h-3.5 w-3.5 text-brand-500" />}>
        <div className="space-y-3">
          <Slider label="图片间距" value={style.gap} min={0} max={80} onChange={(v) => updateStyle({ gap: v })} />
          <Slider label="画布边距" value={style.padding} min={0} max={120} onChange={(v) => updateStyle({ padding: v })} />
          <Slider label="圆角" value={style.radius} min={0} max={80} onChange={(v) => updateStyle({ radius: v })} />
          <Switch
            label="图片阴影"
            checked={style.shadow}
            onChange={(v) => updateStyle({ shadow: v })}
          />
        </div>
      </Section>

      <Section title="背景" icon={<IconPalette className="h-3.5 w-3.5 text-brand-500" />}>
        <Segmented
          className="mb-3 w-full"
          value={style.background.type}
          onChange={(v) => setBg({ type: v })}
          options={[
            { value: 'solid', label: '纯色' },
            { value: 'gradient', label: '渐变' },
            { value: 'transparent', label: '透明' },
          ]}
        />
        {style.background.type === 'solid' ? (
          <ColorPicker value={style.background.color} onChange={(c) => setBg({ color: c ?? '#ffffff' })} />
        ) : null}
        {style.background.type === 'gradient' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {GRADIENTS.map(([c1, c2]) => (
                <button
                  key={c1 + c2}
                  onClick={() => setBg({ color: c1, color2: c2 })}
                  className={cn(
                    'h-8 rounded-md border transition hover:scale-105',
                    style.background.color === c1 && style.background.color2 === c2
                      ? 'border-brand-500 ring-2 ring-brand-200'
                      : 'border-slate-200 dark:border-slate-700',
                  )}
                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.background.color}
                onChange={(e) => setBg({ color: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
              />
              <input
                type="color"
                value={style.background.color2}
                onChange={(e) => setBg({ color2: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
              />
              <TextInput
                value={style.background.color2}
                onChange={(e) => setBg({ color2: e.target.value })}
                className="flex-1"
              />
            </div>
            <Slider label="渐变角度" value={style.background.angle} min={0} max={360} onChange={(v) => setBg({ angle: v })} />
          </div>
        ) : null}
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          想要导出透明底的图片：导出时在「导出图片」面板勾选「透明背景」即可（会忽略这里的背景色 / 渐变）；JPG 会自动填充白色。
        </p>
      </Section>

      <Section title="描边" icon={<IconSquare className="h-3.5 w-3.5 text-brand-500" />}>
        <div className="space-y-3">
          <Slider label="描边宽度" value={style.stroke} min={0} max={30} onChange={(v) => updateStyle({ stroke: v })} />
          {style.stroke > 0 ? (
            <ColorPicker value={style.strokeColor} onChange={(c) => updateStyle({ strokeColor: c ?? '#ffffff' })} />
          ) : null}
        </div>
      </Section>

      <Section title="操作提示" icon={<IconSparkles className="h-3.5 w-3.5 text-brand-500" />}>
        <ul className="space-y-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <li>· 拖动图片到另一格：交换位置</li>
          <li>· Alt / Shift + 拖动：平移图片</li>
          <li>· 滚轮在图片上：缩放该图片</li>
          <li>· 滚轮在空白处：缩放整个预览画布</li>
          <li>· Ctrl / Alt + 滚轮：任意位置都缩放画布</li>
          <li>· 方向键：微调位置；Delete：删除标注</li>
          <li>· 拖动格子分割线：调整格子大小</li>
        </ul>
      </Section>
    </div>
  )
}

/* ------------------------------ 导出 ------------------------------ */

export function ExportDialog({
  open,
  onClose,
  scene,
}: {
  open: boolean
  onClose: () => void
  scene: Omit<DrawOptions, 'scale' | 'preview' | 'selectedAnnoId' | 'transparent'>
}) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [scaleMode, setScaleMode] = useState<ScaleMode>('2x')
  const [quality, setQuality] = useState(0.92)
  const [transparent, setTransparent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const width = targetWidth(scene.width, scaleMode)
  const height = Math.round((scene.height * width) / scene.width)

  const run = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { blob } = await renderToBlob(scene, { format, scaleMode, quality, transparent })
      const ext = format === 'jpeg' ? 'jpg' : format
      downloadBlob(blob, `kupintu-${stamp()}.${ext}`)
      setMsg(`已导出 ${width}×${height}px · ${(blob.size / 1024 / 1024).toFixed(2)}MB`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md animate-fade-up rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <IconDownload className="h-4 w-4 text-brand-500" />
            导出图片
          </h3>
          <button
            onClick={onClose}
            title="关闭"
            aria-label="关闭"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <IconX className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="格式">
            <Segmented
              className="w-full"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpeg', label: 'JPG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </Field>

          <Field label="分辨率" hint={`${width} × ${height} px`}>
            <Segmented
              className="w-full"
              value={scaleMode}
              onChange={setScaleMode}
              options={[
                { value: '1x', label: '1x' },
                { value: '2x', label: '2x' },
                { value: '3x', label: '3x' },
                { value: '4k', label: '4K' },
              ]}
            />
          </Field>

          {format !== 'png' ? (
            <Slider
              label="画质"
              value={quality}
              min={0.5}
              max={1}
              step={0.01}
              onChange={setQuality}
            />
          ) : null}

          {format === 'jpeg' ? null : (
            <div className="space-y-1">
              <Switch label="透明背景" checked={transparent} onChange={setTransparent} />
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                勾选后导出不带背景（忽略背景色 / 渐变）；JPG 会自动填充白色。
              </p>
            </div>
          )}

          <Button variant="primary" size="lg" className="w-full" onClick={run} disabled={busy}>
            <IconDownload className="h-4 w-4" />
            {busy ? '正在渲染…' : '下载图片'}
          </Button>
          {msg ? <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">{msg}</p> : null}
          <p className="text-center text-[11px] text-slate-400">图片仅在浏览器本地处理，不会上传到任何服务器</p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ 移动端工具条 ------------------------------ */

export function MobileTools() {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const items = [
    { value: 'select' as const, label: '选择' },
    { value: 'text' as const, label: '文字' },
    { value: 'arrow' as const, label: '箭头' },
    { value: 'rect' as const, label: '方框' },
    { value: 'ellipse' as const, label: '圆圈' },
  ]
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2 lg:hidden">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => setTool(it.value)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition',
            tool === it.value
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function longPreviewSize(
  order: string[],
  images: Record<string, ImageAsset>,
  style: StyleConfig,
  dir: 'vertical' | 'horizontal',
  cols = 1,
  masonry = false,
) {
  return longLayout(order, images, style, dir, {}, cols, masonry)
}
