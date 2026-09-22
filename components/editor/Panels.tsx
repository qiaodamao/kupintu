'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Background, ImageAsset, StyleConfig } from '@/lib/types'
import { MAX_IMAGES, useEditor } from '@/lib/store'
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
    { value: 'select' as const, label: <IconMove />, title: '选择 / 拖拽' },
    { value: 'text' as const, label: <IconText />, title: '文字' },
    { value: 'arrow' as const, label: <IconArrow />, title: '箭头' },
    { value: 'rect' as const, label: <IconSquare />, title: '方框' },
    { value: 'ellipse' as const, label: <IconCircle />, title: '圆圈' },
  ]

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-slate-200 bg-white/90 px-2 backdrop-blur sm:gap-2 sm:px-3 dark:border-slate-800 dark:bg-slate-900/90">
      <a href="/" className="flex shrink-0 items-center gap-2 sm:mr-1" title="酷拼图">
        <Logo className="h-6 w-6 shrink-0 rounded-md" />
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
            { value: 'vertical', title: '竖向拼接', label: <>竖<span className="hidden sm:inline">向</span></> },
            { value: 'horizontal', title: '横向拼接', label: <>横<span className="hidden sm:inline">向</span></> },
          ]}
        />
      ) : null}

      <div className="mx-1 hidden h-6 w-px shrink-0 bg-slate-200 lg:block dark:bg-slate-700" />
      {/* 绘制工具在窄屏由画布下方的 MobileTools 承担；这里用外层容器控制显隐
          （Segmented / Button 自身带 inline-flex，直接传 hidden 会被它覆盖） */}
      <div className="hidden shrink-0 lg:block">
        <Segmented value={tool} onChange={setTool} options={tools} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
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
        <Button size="sm" variant="primary" onClick={onExport} className="px-2.5 sm:px-3">
          <IconDownload className="h-4 w-4" />
          导出
        </Button>
      </div>
    </header>
  )
}

function IconMove() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M19 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" />
    </svg>
  )
}

/* ------------------------------ 左：图片 ------------------------------ */

export function ImagePanel({ onPick }: { onPick: (files: File[]) => void }) {
  const images = useEditor((s) => s.images)
  const removeImage = useEditor((s) => s.removeImage)
  const clearImages = useEditor((s) => s.clearImages)
  const reorderImages = useEditor((s) => s.reorderImages)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragIndex = useRef<number | null>(null)

  // 只负责收集文件并交给父组件，避免与 onPick 重复添加
  const pick = (files: FileList | null) => {
    if (!files?.length) return
    onPick(Array.from(files))
  }

  return (
    <div className="flex h-full flex-col">
      <Section title="图片素材" icon={<IconImage className="h-3.5 w-3.5 text-brand-500" />}>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
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
          <ul className="scroll-thin max-h-[42vh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={(e) => {
                  dragIndex.current = i
                  e.dataTransfer.setData('application/x-kupintu-image', img.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = dragIndex.current
                  if (from !== null && from !== i) reorderImages(from, i)
                  dragIndex.current = null
                }}
                className="group flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
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
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          拖动缩略图可调整顺序；拖到画布上的格子即可替换图片。
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
        <Section title="拼接设置" icon={<IconLong className="h-3.5 w-3.5 text-brand-500" />}>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            长图模式按左侧图片顺序依次拼接，拖动左侧缩略图即可调整顺序；画布尺寸自动计算，不受比例限制。
          </p>
          <Button size="sm" variant="ghost" className="w-full" onClick={resetTransforms}>
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
        {style.background.type === 'transparent' ? (
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            透明背景导出 PNG 时生效；导出 JPG 会自动填充白色。
          </p>
        ) : null}
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            关闭
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

          {format === 'png' ? (
            <Switch label="透明背景" checked={transparent} onChange={setTransparent} />
          ) : null}

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
) {
  return longLayout(order, images, style, dir, {})
}
