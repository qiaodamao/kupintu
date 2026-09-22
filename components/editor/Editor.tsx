'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ImageAsset } from '@/lib/types'
import { useEditor } from '@/lib/store'
import { gridCanvasSize, gridSlots, longLayout } from '@/lib/render'
import type { LongLayout, Slot } from '@/lib/render'
import CanvasStage from './CanvasStage'
import { ExportDialog, ImagePanel, MobileTools, StylePanel, TopBar } from './Panels'
import { IconImage, IconLayers, IconPalette, IconUpload } from '@/components/Icons'

export default function Editor() {
  const mode = useEditor((s) => s.mode)
  const style = useEditor((s) => s.style)
  const tree = useEditor((s) => s.tree)
  const placements = useEditor((s) => s.placements)
  const images = useEditor((s) => s.images)
  const annotations = useEditor((s) => s.annotations)
  const longDir = useEditor((s) => s.longDir)
  const addFiles = useEditor((s) => s.addFiles)
  const tool = useEditor((s) => s.tool)

  const [tick, setTick] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [tab, setTab] = useState<'none' | 'images' | 'style'>('images')
  const cache = useRef<Map<string, HTMLImageElement>>(new Map())

  const imageMap = useMemo(() => {
    const m: Record<string, ImageAsset> = {}
    for (const i of images) m[i.id] = i
    return m
  }, [images])

  const order = useMemo(() => images.map((i) => i.id), [images])

  useEffect(() => {
    for (const img of images) {
      if (cache.current.has(img.url)) continue
      const el = new Image()
      el.onload = () => setTick((t) => t + 1)
      el.onerror = () => setTick((t) => t + 1)
      el.src = img.url
      cache.current.set(img.url, el)
    }
  }, [images])

  const getImage = useCallback((url: string) => cache.current.get(url), [])

  // 仅开发环境：暴露 store 供 e2e 脚本读取状态（生产构建会被剔除）
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') (window as unknown as Record<string, unknown>).__store = useEditor
  }, [])

  const long = useMemo<LongLayout>(
    () => longLayout(order, imageMap, style, longDir, placements),
    [order, imageMap, style, longDir, placements],
  )

  const size = useMemo(
    () => (mode === 'grid' ? gridCanvasSize(style.aspect) : { width: long.width, height: long.height }),
    [mode, style.aspect, long.width, long.height],
  )

  const slots = useMemo<Slot[]>(
    () => (mode === 'grid' ? gridSlots(tree, style, size.width, size.height, placements) : long.slots),
    [mode, tree, style, size.width, size.height, placements, long.slots],
  )

  const scene = useMemo(
    () => ({
      slots,
      images: imageMap,
      getImage,
      style,
      annotations,
      width: size.width,
      height: size.height,
    }),
    [slots, imageMap, getImage, style, annotations, size.width, size.height],
  )

  const pick = (files: File[]) => void addFiles(files)

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar onExport={() => setExportOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <aside className="scroll-thin hidden w-[276px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
          <ImagePanel onPick={pick} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="checkerboard relative min-h-0 flex-1">
            <CanvasStage
              width={size.width}
              height={size.height}
              slots={slots}
              imageMap={imageMap}
              getImage={getImage}
              redrawTick={tick}
            />
            {images.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
                <div className="pointer-events-auto max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white">
                    <IconUpload className="h-5 w-5" />
                  </div>
                  <h2 className="mb-1 text-sm font-semibold">先添加几张图片</h2>
                  <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    支持批量上传，图片只在你的浏览器里处理，不会上传到服务器。
                  </p>
                  <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition-colors hover:bg-brand-700">
                    <IconImage className="h-4 w-4" />
                    选择图片
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        pick(Array.from(e.target.files ?? []))
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <MobileTools />
        </main>

        <aside className="scroll-thin hidden w-[304px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
          <StylePanel />
        </aside>
      </div>

      {/* 移动端面板 */}
      <div className="lg:hidden">
        {tab !== 'none' ? (
          <div className="scroll-thin max-h-[46vh] overflow-y-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {tab === 'images' ? <ImagePanel onPick={pick} /> : <StylePanel />}
          </div>
        ) : null}
        <nav className="flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {(
            [
              { key: 'images', label: '图片', icon: <IconImage className="h-4 w-4" /> },
              { key: 'style', label: '样式', icon: <IconPalette className="h-4 w-4" /> },
              { key: 'none', label: '隐藏', icon: <IconLayers className="h-4 w-4" /> },
            ] as const
          ).map((it) => (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                tab === it.key ? 'text-brand-600' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </nav>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} scene={scene} />

      {tool !== 'select' ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1.5 text-[11px] text-white lg:hidden">
          已选择绘制工具，点击画布添加
        </div>
      ) : null}
    </div>
  )
}
