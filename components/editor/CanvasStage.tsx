'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Annotation, ImageAsset, Rect, SlotTransform } from '@/lib/types'
import { annotationBounds, drawScene, getTextSize } from '@/lib/render'
import type { Slot } from '@/lib/render'
import type { SplitHit } from '@/lib/layout'
import { findLeafAt, findSplitAt, rectOfNode, splitGeomAt } from '@/lib/layout'
import { useEditor } from '@/lib/store'
import { Button } from '@/components/ui'
import { IconFit, IconPlus, IconTrash, IconX } from '@/components/Icons'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'start' | 'end'

interface View {
  zoom: number
  px: number
  py: number
}

type DragState =
  | { kind: 'none' }
  | { kind: 'view'; sx: number; sy: number; px: number; py: number }
  | { kind: 'split'; id: string; dir: 'v' | 'h'; rect: Rect }
  | { kind: 'image-pan'; slotId: string; sx: number; sy: number; dx: number; dy: number }
  | { kind: 'image-swap'; slotId: string; sx: number; sy: number; active: boolean }
  | { kind: 'anno-move'; id: string; sx: number; sy: number; start: Annotation }
  | { kind: 'anno-resize'; id: string; handle: Handle; start: Annotation; sx: number; sy: number }
  | { kind: 'draw'; id: string; sx: number; sy: number; type: 'rect' | 'ellipse' | 'arrow' }

let _mctx: CanvasRenderingContext2D | null = null
function measureCtx(): CanvasRenderingContext2D {
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d')!
  return _mctx
}

function pointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function hitAnnotation(list: Annotation[], x: number, y: number, tol: number): Annotation | null {
  const ctx = measureCtx()
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i]
    if (a.type === 'arrow') {
      if (pointToSegment(x, y, a.x1, a.y1, a.x2, a.y2) <= tol + a.width / 2) return a
      continue
    }
    const b = annotationBounds(ctx, a)
    const inside = x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol
    if (!inside) continue
    if (a.type === 'text') return a
    if (a.fill) return a
    // 空心图形：仅边缘命中
    if (a.type === 'ellipse') {
      const rx = Math.abs(a.w / 2)
      const ry = Math.abs(a.h / 2)
      if (rx < 1 || ry < 1) continue
      const nx = (x - (a.x + a.w / 2)) / rx
      const ny = (y - (a.y + a.h / 2)) / ry
      const d = Math.abs(Math.hypot(nx, ny) - 1)
      if (d * Math.min(rx, ry) <= tol + a.strokeWidth / 2) return a
      continue
    }
    const inner =
      x > b.x + tol + a.strokeWidth &&
      x < b.x + b.w - tol - a.strokeWidth &&
      y > b.y + tol + a.strokeWidth &&
      y < b.y + b.h - tol - a.strokeWidth
    if (!inner) return a
  }
  return null
}

function handlePositions(b: Rect): Array<{ h: Handle; x: number; y: number }> {
  const { x, y, w, h } = b
  return [
    { h: 'nw', x, y },
    { h: 'n', x: x + w / 2, y },
    { h: 'ne', x: x + w, y },
    { h: 'e', x: x + w, y: y + h / 2 },
    { h: 'se', x: x + w, y: y + h },
    { h: 's', x: x + w / 2, y: y + h },
    { h: 'sw', x, y: y + h },
    { h: 'w', x, y: y + h / 2 },
  ]
}

/** 大于该缩放即视为「已放大」，此时左键拖动 = 调整图片位置 */
const ZOOM_EPS = 1.005

function slotImage(slot: Slot | undefined, imageMap: Record<string, ImageAsset>, getImage: (url: string) => HTMLImageElement | undefined) {
  const asset = slot?.placement?.imageId ? imageMap[slot.placement.imageId] : undefined
  return asset ? getImage(asset.url) : undefined
}

/** 约束平移量：图片放大后不允许拖出空白（dx/dy 是相对格子中心的逻辑偏移） */
function clampTf(rect: Rect, tf: SlotTransform, img?: HTMLImageElement): SlotTransform {
  if (!img || !img.naturalWidth || !img.naturalHeight) return tf
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight)
  const w = img.naturalWidth * base * tf.scale
  const h = img.naturalHeight * base * tf.scale
  const mx = Math.max(0, (w - rect.w) / 2)
  const my = Math.max(0, (h - rect.h) / 2)
  return {
    scale: tf.scale,
    dx: Math.max(-mx, Math.min(mx, tf.dx)),
    dy: Math.max(-my, Math.min(my, tf.dy)),
  }
}

const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  start: 'move',
  end: 'move',
}

export interface CanvasStageProps {
  width: number
  height: number
  slots: Slot[]
  imageMap: Record<string, ImageAsset>
  getImage: (url: string) => HTMLImageElement | undefined
  redrawTick: number
  onViewChange?: (v: { zoom: number }) => void
  viewRef?: React.MutableRefObject<{ zoom: number; fit: () => void } | null>
}

export default function CanvasStage({
  width,
  height,
  slots,
  imageMap,
  getImage,
  redrawTick,
  viewRef,
}: CanvasStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ zoom: 1, px: 0, py: 0 })
  const [hoverSlot, setHoverSlot] = useState<string | null>(null)
  /** 悬停/拖动中的分割线，用于显示拖拽提示 */
  const [splitHi, setSplitHi] = useState<SplitHit | null>(null)
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null)
  const dragRef = useRef<DragState>({ kind: 'none' })
  const [dragKind, setDragKind] = useState<DragState['kind']>('none')
  /** 本次拖动是否开启了撤销事务 */
  const txnRef = useRef(false)
  /** 活跃指针（触摸时会有多个），用于识别双指缩放 */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  /** 双指缩放基准：起始指间距与当时的视图缩放 */
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)

  const style = useEditor((s) => s.style)
  const annotations = useEditor((s) => s.annotations)
  const tool = useEditor((s) => s.tool)
  const mode = useEditor((s) => s.mode)
  const tree = useEditor((s) => s.tree)
  const selectedAnnoId = useEditor((s) => s.selectedAnnoId)
  const selectedSlotId = useEditor((s) => s.selectedSlotId)
  const placements = useEditor((s) => s.placements)
  const setTool = useEditor((s) => s.setTool)
  const addAnnotation = useEditor((s) => s.addAnnotation)
  const updateAnnotation = useEditor((s) => s.updateAnnotation)
  const removeAnnotation = useEditor((s) => s.removeAnnotation)
  const selectAnnotation = useEditor((s) => s.selectAnnotation)
  const selectSlot = useEditor((s) => s.selectSlot)
  const setRatio = useEditor((s) => s.setRatio)
  const swapSlots = useEditor((s) => s.swapSlots)
  const setSlotTransform = useEditor((s) => s.setSlotTransform)
  const setSlotImage = useEditor((s) => s.setSlotImage)
  const addFiles = useEditor((s) => s.addFiles)
  const images = useEditor((s) => s.images)
  const reorderImages = useEditor((s) => s.reorderImages)
  const swapImages = useEditor((s) => s.swapImages)
  const removeImage = useEditor((s) => s.removeImage)
  const beginTransaction = useEditor((s) => s.beginTransaction)
  const endTransaction = useEditor((s) => s.endTransaction)

  /* ---------------- 视图 ---------------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fitScale = useMemo(() => {
    if (!box.w || !box.h) return 1
    return Math.min((box.w - 48) / width, (box.h - 48) / height)
  }, [box.w, box.h, width, height])

  const getTransform = useCallback(() => {
    const s = fitScale * view.zoom
    return {
      s,
      tx: (box.w - width * s) / 2 + view.px,
      ty: (box.h - height * s) / 2 + view.py,
    }
  }, [fitScale, view, box, width, height])

  const toLogical = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapRef.current
      if (!el) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const { s, tx, ty } = getTransform()
      return { x: (clientX - r.left - tx) / s, y: (clientY - r.top - ty) / s }
    },
    [getTransform],
  )

  const toScreen = useCallback(
    (x: number, y: number) => {
      const { s, tx, ty } = getTransform()
      return { x: x * s + tx, y: y * s + ty, s }
    },
    [getTransform],
  )

  /** 扣除画布边距后的布局区域（逻辑坐标） */
  const innerRect = useMemo(
    () => ({
      x: style.padding,
      y: style.padding,
      w: Math.max(1, width - style.padding * 2),
      h: Math.max(1, height - style.padding * 2),
    }),
    [style.padding, width, height],
  )

  /** 分割线命中容差：至少覆盖半个间距，保证缝隙全长都能命中 */
  const splitTol = Math.max((8 / (fitScale * view.zoom)) * 1.6, style.gap * 0.6)

  const detectSplit = useCallback(
    (p: { x: number; y: number }): SplitHit | null => {
      if (mode !== 'grid' || tool !== 'select') return null
      return findSplitAt(tree, innerRect, style.gap, p.x, p.y, splitTol)
    },
    [mode, tool, tree, innerRect, style.gap, splitTol],
  )

  /** 只在 id 变化时才替换，避免 pointermove 高频 setState */
  const syncSplitHi = useCallback(
    (hit: SplitHit | null) => setSplitHi((prev) => (prev?.id === hit?.id ? prev : hit)),
    [],
  )

  // 切换工具或离开布局拼图模式时清掉提示
  useEffect(() => {
    if (tool !== 'select' || mode !== 'grid') setSplitHi(null)
  }, [tool, mode])

  /** 以屏幕坐标 (clientX, clientY) 为锚点缩放到指定倍率：该点下的画布内容位置保持不变 */
  const zoomTo = useCallback(
    (zoom: number, clientX: number, clientY: number) => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const ax = clientX - r.left
      const ay = clientY - r.top
      setView((v) => {
        const s0 = fitScale * v.zoom
        const px0 = (box.w - width * s0) / 2 + v.px
        const py0 = (box.h - height * s0) / 2 + v.py
        const lx = (ax - px0) / s0
        const ly = (ay - py0) / s0
        const z = Math.max(0.2, Math.min(4, zoom))
        const s1 = fitScale * z
        return {
          zoom: z,
          px: ax - lx * s1 - (box.w - width * s1) / 2,
          py: ay - ly * s1 - (box.h - height * s1) / 2,
        }
      })
    },
    [fitScale, box.w, box.h, width, height],
  )

  const fit = useCallback(() => setView({ zoom: 1, px: 0, py: 0 }), [])
  useEffect(() => {
    if (viewRef) viewRef.current = { zoom: view.zoom, fit }
  }, [viewRef, view.zoom, fit])

  /* ---------------- 绘制 ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !box.w || !box.h) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(box.w * dpr)
    canvas.height = Math.round(box.h * dpr)
    canvas.style.width = `${box.w}px`
    canvas.style.height = `${box.h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { s, tx, ty } = getTransform()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, box.w, box.h)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(s, s)
    drawScene(ctx, {
      slots,
      images: imageMap,
      getImage,
      style,
      annotations,
      width,
      height,
      scale: s,
      selectedAnnoId,
      preview: true,
    })
    ctx.restore()
  }, [box, view, slots, style, annotations, selectedAnnoId, width, height, imageMap, getImage, getTransform, redrawTick])

  /* ---------------- 滚轮：缩放图片 / 画布 ---------------- */
  // 用 ref 持有最新上下文，使监听器只绑定一次（否则每次缩放都会重绑，事务被打断）
  const wheelCtx = useRef({
    toLogical,
    slots,
    placements,
    setSlotTransform,
    style,
    tree,
    width,
    height,
    mode,
    imageMap,
    getImage,
    fitScale,
    box,
    view,
  })
  wheelCtx.current = {
    toLogical,
    slots,
    placements,
    setSlotTransform,
    style,
    tree,
    width,
    height,
    mode,
    imageMap,
    getImage,
    fitScale,
    box,
    view,
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let timer: number | null = null

    /** 归一化滚轮步长：行模式(1)每格约 16px，页模式(2)约一屏 */
    const normDelta = (e: WheelEvent) =>
      e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY

    /** 以光标为锚点缩放预览视图：光标下的画布点在缩放前后屏幕位置不变 */
    const zoomView = (delta: number, clientX: number, clientY: number) => {
      const c = wheelCtx.current
      const r = el.getBoundingClientRect()
      const cx = clientX - r.left
      const cy = clientY - r.top
      // 单次步长夹在 0.5~2 倍，避免触控板惯性滚动一次性跳太多
      const factor = Math.max(0.5, Math.min(2, Math.exp(-delta * 0.0012)))
      setView((v) => {
        const s0 = c.fitScale * v.zoom
        const px0 = (c.box.w - c.width * s0) / 2 + v.px
        const py0 = (c.box.h - c.height * s0) / 2 + v.py
        // 当前光标对应的画布逻辑坐标
        const lx = (cx - px0) / s0
        const ly = (cy - py0) / s0
        const zoom = Math.max(0.2, Math.min(4, v.zoom * factor))
        const s1 = c.fitScale * zoom
        return {
          zoom,
          px: cx - lx * s1 - (c.box.w - c.width * s1) / 2,
          py: cy - ly * s1 - (c.box.h - c.height * s1) / 2,
        }
      })
    }

    /** 光标是否落在「有图」的格子上；返回 null 表示应缩放视图 */
    const pickImageSlot = (p: { x: number; y: number }): { id: string; rect: Rect } | null => {
      const c = wheelCtx.current
      const inner = {
        x: c.style.padding,
        y: c.style.padding,
        w: c.width - c.style.padding * 2,
        h: c.height - c.style.padding * 2,
      }
      for (const s of c.slots) {
        const r = s.rect
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          return s.placement?.imageId ? { id: s.id, rect: r } : null
        }
      }
      if (c.mode === 'grid') {
        const leafId = findLeafAt(c.tree, inner, c.style.gap, p.x, p.y)
        if (leafId && c.placements[leafId]?.imageId) {
          const rect = rectOfNode(c.tree, leafId, inner, c.style.gap)
          if (rect) return { id: leafId, rect }
        }
      }
      return null
    }

    const onWheel = (e: WheelEvent) => {
      const c = wheelCtx.current
      e.preventDefault()
      const delta = normDelta(e)
      // Ctrl/⌘/Alt 强制缩放视图；否则智能区分：图片上缩放图片，空白处缩放视图
      const forceView = e.ctrlKey || e.metaKey || e.altKey
      if (!forceView) {
        const p = c.toLogical(e.clientX, e.clientY)
        const hit = pickImageSlot(p)
        if (hit) {
          const cur = c.placements[hit.id]?.tf ?? { scale: 1, dx: 0, dy: 0 }
          const next = Math.max(0.2, Math.min(6, cur.scale * (delta > 0 ? 0.94 : 1.06)))
          const k = next / cur.scale
          // 以光标位置为锚点缩放：dx1 = m - (m - dx0) * k，m 为光标相对格子中心的偏移
          const mx = p.x - (hit.rect.x + hit.rect.w / 2)
          const my = p.y - (hit.rect.y + hit.rect.h / 2)
          const img = slotImage(
            c.slots.find((s) => s.id === hit.id),
            c.imageMap,
            c.getImage,
          )
          const tf = clampTf(hit.rect, { scale: next, dx: mx - (mx - cur.dx) * k, dy: my - (my - cur.dy) * k }, img)
          // 连续滚轮合并为一次撤销
          if (timer === null) beginTransaction()
          else if (timer) window.clearTimeout(timer)
          timer = window.setTimeout(() => {
            timer = null
            endTransaction()
          }, 600)
          c.setSlotTransform(hit.id, tf)
          return
        }
      }
      zoomView(delta, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (timer) {
        window.clearTimeout(timer)
        endTransaction()
      }
    }
  }, [beginTransaction, endTransaction])

  /* ---------------- 指针交互 ---------------- */
  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // 第二根手指落下 → 进入双指缩放，放弃正在进行的拖拽（否则会和图片拖动打架）
    if (pointersRef.current.size >= 2) {
      if (txnRef.current) {
        endTransaction()
        txnRef.current = false
      }
      dragRef.current = { kind: 'none' }
      setDragKind('none')
      setSplitHi(null)
      const [a, b] = Array.from(pointersRef.current.values())
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom }
      return
    }
    // 点在浮层控件（缩放按钮、图片工具条、标注工具条等）上时不要接管指针：
    // 一旦调用 setPointerCapture，后续 click 会被重定向到容器，按钮的 onClick 就再也收不到
    const t = e.target as HTMLElement | null
    if (t?.closest('button,input,textarea,select,a,[data-no-drag]')) return
    const el = wrapRef.current!
    el.setPointerCapture(e.pointerId)
    const p = toLogical(e.clientX, e.clientY)
    const tolView = 8 / (fitScale * view.zoom)

    if (tool !== 'select') {
      const id = `a${Date.now().toString(36)}`
      if (tool === 'text') {
        addAnnotation({
          id,
          type: 'text',
          x: p.x,
          y: p.y,
          text: '双击编辑文字',
          color: '#111827',
          fontSize: 48,
          bold: true,
          bg: null,
          align: 'left',
        })
        setEditingText({ id, value: '双击编辑文字' })
        dragRef.current = { kind: 'none' }
        setDragKind('none')
      } else if (tool === 'arrow') {
        addAnnotation({ id, type: 'arrow', x1: p.x, y1: p.y, x2: p.x + 160, y2: p.y + 90, color: '#ef4444', width: 8, dashed: false })
        txnRef.current = true
        beginTransaction()
        dragRef.current = { kind: 'draw', id, sx: p.x, sy: p.y, type: 'arrow' }
        setDragKind('draw')
      } else {
        addAnnotation({
          id,
          type: tool,
          x: p.x,
          y: p.y,
          w: 220,
          h: 160,
          color: '#6366f1',
          fill: null,
          strokeWidth: 8,
          radius: 8,
          dashed: false,
        })
        txnRef.current = true
        beginTransaction()
        dragRef.current = { kind: 'draw', id, sx: p.x, sy: p.y, type: tool }
        setDragKind('draw')
      }
      return
    }

    // 1) 选中标注的手柄
    if (selectedAnnoId) {
      const sel = annotations.find((a) => a.id === selectedAnnoId)
      if (sel) {
        const ctx = measureCtx()
        const b = annotationBounds(ctx, sel)
        const hs =
          sel.type === 'arrow'
            ? ([
                { h: 'start' as Handle, x: sel.x1, y: sel.y1 },
                { h: 'end' as Handle, x: sel.x2, y: sel.y2 },
              ])
            : handlePositions(b)
        for (const hp of hs) {
          if (Math.hypot(p.x - hp.x, p.y - hp.y) <= tolView * 1.4) {
            txnRef.current = true
            beginTransaction()
            dragRef.current = { kind: 'anno-resize', id: sel.id, handle: hp.h, start: sel, sx: p.x, sy: p.y }
            setDragKind('anno-resize')
            return
          }
        }
      }
    }

    // 2) 标注本体
    const hit = hitAnnotation(annotations, p.x, p.y, tolView)
    if (hit) {
      selectAnnotation(hit.id)
      txnRef.current = true
      beginTransaction()
      dragRef.current = { kind: 'anno-move', id: hit.id, sx: p.x, sy: p.y, start: hit }
      setDragKind('anno-move')
      return
    }
    selectAnnotation(null)

    // 3) 分割线
    if (mode === 'grid') {
      const inner = innerRect
      const split = findSplitAt(tree, inner, style.gap, p.x, p.y, splitTol)
      if (split) {
        const rect = rectOfNode(tree, split.id, inner, style.gap)
        setSplitHi(split)
        txnRef.current = true
        beginTransaction()
        dragRef.current = { kind: 'split', id: split.id, dir: split.dir, rect: rect ?? inner }
        setDragKind('split')
        return
      }
      const leafId = findLeafAt(tree, inner, style.gap, p.x, p.y)
      if (leafId) {
        const pl = placements[leafId]
        const tf = pl?.tf ?? { scale: 1, dx: 0, dy: 0 }
        selectSlot(leafId)
        if (pl?.imageId) {
          // 图片已放大（或按住 Alt）→ 左键拖动调整位置；未放大时拖动 = 交换图片
          // 按住 Shift 始终为交换，方便放大后仍可调换顺序
          const wantPan = !e.shiftKey && (e.altKey || tf.scale > ZOOM_EPS)
          if (wantPan) {
            txnRef.current = true
            beginTransaction()
            dragRef.current = { kind: 'image-pan', slotId: leafId, sx: p.x, sy: p.y, dx: tf.dx, dy: tf.dy }
            setDragKind('image-pan')
          } else {
            dragRef.current = { kind: 'image-swap', slotId: leafId, sx: p.x, sy: p.y, active: false }
            setDragKind('image-swap')
          }
        }
        return
      }
    } else {
      for (const s of slots) {
        const r = s.rect
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const tf = s.placement?.tf ?? { scale: 1, dx: 0, dy: 0 }
          selectSlot(s.id)
          if (s.placement?.imageId) {
            // 与网格模式保持一致：没放大（或按住 Shift）拖动 = 交换顺序；已放大 / 按住 Alt = 平移
            const wantPan = !e.shiftKey && (e.altKey || tf.scale > ZOOM_EPS)
            if (wantPan) {
              txnRef.current = true
              beginTransaction()
              dragRef.current = { kind: 'image-pan', slotId: s.id, sx: p.x, sy: p.y, dx: tf.dx, dy: tf.dy }
              setDragKind('image-pan')
            } else {
              dragRef.current = { kind: 'image-swap', slotId: s.id, sx: p.x, sy: p.y, active: false }
              setDragKind('image-swap')
            }
          }
          return
        }
      }
    }

    // 4) 空白 → 平移视图
    dragRef.current = { kind: 'view', sx: e.clientX, sy: e.clientY, px: view.px, py: view.py }
    setDragKind('view')
  }

  /** 落点所在的格子：长图按槽位矩形找（一格就是一张图），网格按布局树找叶子 */
  const targetSlotAt = (p: { x: number; y: number }): string | null => {
    for (const s of slots) {
      const r = s.rect
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return s.id
    }
    if (mode === 'grid') {
      const inner = { x: style.padding, y: style.padding, w: width - style.padding * 2, h: height - style.padding * 2 }
      return findLeafAt(tree, inner, style.gap, p.x, p.y)
    }
    return null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    // 双指缩放：以两指中点为锚点，按指间距比例缩放预览视图
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      zoomTo(pinchRef.current.zoom * (dist / pinchRef.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2)
      return
    }
    const d = dragRef.current
    const p = toLogical(e.clientX, e.clientY)
    if (d.kind === 'none') {
      // hover：优先检测分割线（图片间距），命中则显示拖拽提示并切换光标
      const hit = detectSplit(p)
      syncSplitHi(hit)
      if (hit) {
        if (hoverSlot) setHoverSlot(null)
        return
      }
      // hover 高亮
      const inner = { x: style.padding, y: style.padding, w: width - style.padding * 2, h: height - style.padding * 2 }
      let id: string | null = null
      for (const s of slots) {
        const r = s.rect
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) id = s.id
      }
      if (!id && mode === 'grid') id = findLeafAt(tree, inner, style.gap, p.x, p.y)
      if (id !== hoverSlot) setHoverSlot(id)
      return
    }
    if (d.kind === 'view') {
      setView((v) => ({ ...v, px: d.px + (e.clientX - d.sx), py: d.py + (e.clientY - d.sy) }))
      return
    }
    if (d.kind === 'split') {
      const r = d.rect
      const ratio = d.dir === 'v' ? (p.x - r.x) / Math.max(1, r.w) : (p.y - r.y) / Math.max(1, r.h)
      setRatio(d.id, ratio)
      return
    }
    if (d.kind === 'image-pan') {
      const slot = slots.find((s) => s.id === d.slotId)
      const cur = placements[d.slotId]?.tf ?? { scale: 1, dx: 0, dy: 0 }
      const next = { scale: cur.scale, dx: d.dx + (p.x - d.sx), dy: d.dy + (p.y - d.sy) }
      setSlotTransform(
        d.slotId,
        slot ? clampTf(slot.rect, next, slotImage(slot, imageMap, getImage)) : next,
      )
      return
    }
    if (d.kind === 'image-swap') {
      if (!d.active && Math.hypot(p.x - d.sx, p.y - d.sy) > 6) {
        dragRef.current = { ...d, active: true }
        setDragKind('image-swap')
      }
      const target = targetSlotAt(p)
      if (target !== hoverSlot) setHoverSlot(target)
      return
    }
    if (d.kind === 'anno-move') {
      const dx = p.x - d.sx
      const dy = p.y - d.sy
      const a = d.start
      if (a.type === 'arrow') {
        updateAnnotation(a.id, { x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy } as any)
      } else {
        updateAnnotation(a.id, { x: (a as any).x + dx, y: (a as any).y + dy } as any)
      }
      return
    }
    if (d.kind === 'anno-resize') {
      const start = d.start
      const dx = p.x - d.sx
      const dy = p.y - d.sy
      if (start.type === 'arrow') {
        if (d.handle === 'start') updateAnnotation(start.id, { x1: start.x1 + dx, y1: start.y1 + dy })
        else updateAnnotation(start.id, { x2: start.x2 + dx, y2: start.y2 + dy })
        return
      }
      const ctx = measureCtx()
      const b0 = annotationBounds(ctx, start)
      let { x, y, w, h } = b0
      if (d.handle.includes('w')) {
        x = b0.x + dx
        w = b0.w - dx
      }
      if (d.handle.includes('e')) w = b0.w + dx
      if (d.handle.includes('n')) {
        y = b0.y + dy
        h = b0.h - dy
      }
      if (d.handle.includes('s')) h = b0.h + dy
      const nw = Math.max(12, w)
      const nh = Math.max(12, h)
      if (start.type === 'text') {
        const k = Math.max(0.25, Math.min(6, nw / Math.max(1, b0.w)))
        const pad = start.fontSize * 0.28
        updateAnnotation(start.id, {
          fontSize: Math.max(10, Math.min(400, Math.round(start.fontSize * k))),
          x: x + pad * k,
          y: y + pad * 0.6 * k,
        } as any)
      } else {
        updateAnnotation(start.id, {
          x: d.handle.includes('w') ? x + (w - nw) : x,
          y: d.handle.includes('n') ? y + (h - nh) : y,
          w: nw,
          h: nh,
        } as any)
      }
      return
    }
    if (d.kind === 'draw') {
      if (d.type === 'arrow') {
        updateAnnotation(d.id, { x2: p.x, y2: p.y })
      } else {
        updateAnnotation(d.id, {
          x: Math.min(d.sx, p.x),
          y: Math.min(d.sy, p.y),
          w: Math.abs(p.x - d.sx),
          h: Math.abs(p.y - d.sy),
        })
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    const d = dragRef.current
    const p = toLogical(e.clientX, e.clientY)
    // 交换图片必须在清空 dragRef 之前处理：否则拿到的已经是空状态（原来放在收尾之后，等于永远不执行）
    if (d.kind === 'image-swap' && d.active) {
      const target = targetSlotAt(p)
      if (target && target !== d.slotId) {
        if (mode === 'long') swapImages(d.slotId, target)
        else swapSlots(d.slotId, target)
      }
    }
    // 手指少于两根即退出缩放态；剩下的一根不再续接之前的拖拽
    if (pointersRef.current.size < 2) {
      pinchRef.current = null
      if (dragRef.current.kind !== 'none') {
        if (txnRef.current) {
          endTransaction()
          txnRef.current = false
        }
        dragRef.current = { kind: 'none' }
        setDragKind('none')
        return
      }
    }
    if (txnRef.current) {
      endTransaction()
      txnRef.current = false
    }
    dragRef.current = { kind: 'none' }
    setDragKind('none')
    syncSplitHi(detectSplit(p))
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (txnRef.current) {
      endTransaction()
      txnRef.current = false
    }
    dragRef.current = { kind: 'none' }
    setDragKind('none')
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = toLogical(e.clientX, e.clientY)
    const hit = hitAnnotation(annotations, p.x, p.y, 6 / (fitScale * view.zoom))
    if (hit && hit.type === 'text') setEditingText({ id: hit.id, value: hit.text })
  }

  /* ---------------- 键盘 ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const store = useEditor.getState()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedAnnoId) {
          e.preventDefault()
          removeAnnotation(store.selectedAnnoId)
        }
        return
      }
      if (e.key === 'Escape') {
        store.selectAnnotation(null)
        store.selectSlot(null)
        setEditingText(null)
        return
      }
      const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      if (arrows.includes(e.key)) {
        const step = e.shiftKey ? 10 : 1
        if (store.selectedAnnoId) {
          e.preventDefault()
          const a = store.annotations.find((x) => x.id === store.selectedAnnoId)
          if (!a) return
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          if (a.type === 'arrow') {
            store.updateAnnotation(a.id, { x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy })
          } else {
            store.updateAnnotation(a.id, { x: (a as any).x + dx, y: (a as any).y + dy })
          }
        } else if (store.selectedSlotId && store.placements[store.selectedSlotId]) {
          e.preventDefault()
          const tf = store.placements[store.selectedSlotId].tf
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          store.setSlotTransform(store.selectedSlotId, { dx: tf.dx + dx * 2, dy: tf.dy + dy * 2 })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeAnnotation])

  /* ---------------- 拖放文件 / 图片池图片 ---------------- */
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setSplitHi(null)
    const p = toLogical(e.clientX, e.clientY)
    const inner = { x: style.padding, y: style.padding, w: width - style.padding * 2, h: height - style.padding * 2 }
    let id: string | null = null
    for (const s of slots) {
      const r = s.rect
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) id = s.id
    }
    if (!id && mode === 'grid') id = findLeafAt(tree, inner, style.gap, p.x, p.y)
    if (id !== hoverSlot) setHoverSlot(id)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData('application/x-kupintu-image')
    const p = toLogical(e.clientX, e.clientY)
    const inner = { x: style.padding, y: style.padding, w: width - style.padding * 2, h: height - style.padding * 2 }
    let slotId: string | null = null
    for (const s of slots) {
      const r = s.rect
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) slotId = s.id
    }
    if (!slotId && mode === 'grid') slotId = findLeafAt(tree, inner, style.gap, p.x, p.y)
    // 关键：拖拽 <img> 时浏览器会把这张图同时塞进 dataTransfer.files，
    // 必须先认自定义数据，否则素材池里的图会被当成「新文件」再复制一份。
    if (imageId && slotId) {
      if (mode === 'long') {
        // 长图模式一格就是一张图（slot id === 图片 id），没有「替换」这回事：
        // 拖上来的是调整这张图在拼接条里的位置，否则会出现空槽 + 图片重复。
        const from = images.findIndex((i) => i.id === imageId)
        const to = images.findIndex((i) => i.id === slotId)
        if (from >= 0 && to >= 0 && from !== to) reorderImages(from, to)
      } else {
        setSlotImage(slotId, imageId)
      }
    } else if (!imageId && e.dataTransfer.files?.length) {
      // 真正的外部文件才走「新增到素材池」
      void addFiles(Array.from(e.dataTransfer.files))
    }
    setHoverSlot(null)
  }

  /* ---------------- 覆盖层 ---------------- */
  const selected = annotations.find((a) => a.id === selectedAnnoId) ?? null
  const selBounds = selected ? annotationBounds(measureCtx(), selected) : null
  const selSlot = selectedSlotId ? slots.find((s) => s.id === selectedSlotId) : null
  const hoverRect = hoverSlot ? slots.find((s) => s.id === hoverSlot)?.rect : null

  /** 分割线实时几何：拖动过程中随比例变化 */
  const activeSplit = splitHi ? (splitGeomAt(tree, splitHi.id, innerRect, style.gap) ?? splitHi) : null
  const splitBar = useMemo(() => {
    if (!activeSplit) return null
    const isV = activeSplit.dir === 'v'
    const a = isV ? toScreen(activeSplit.pos, activeSplit.start) : toScreen(activeSplit.start, activeSplit.pos)
    const b = isV ? toScreen(activeSplit.pos, activeSplit.end) : toScreen(activeSplit.end, activeSplit.pos)
    return {
      isV,
      line: isV
        ? { left: a.x - 2, top: a.y, width: 4, height: Math.max(2, b.y - a.y) }
        : { left: a.x, top: a.y - 2, width: Math.max(2, b.x - a.x), height: 4 },
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    }
  }, [activeSplit, toScreen])

  const boxScreen = (r: Rect) => {
    const { x, y, s } = toScreen(r.x, r.y)
    const w = r.w * s
    const h = r.h * s
    // 描边圆角跟随样式里的圆角（并换算到屏幕像素）：样式圆角为 0 时，选中框也必须是直角
    const radius = Math.max(0, Math.min(style.radius * s, Math.min(w, h) / 2))
    return { left: x, top: y, width: w, height: h, borderRadius: radius }
  }

  const hoverSlotObj = hoverSlot ? slots.find((s) => s.id === hoverSlot) : null
  const hoverZoomed = !!hoverSlotObj?.placement?.imageId && (hoverSlotObj.placement.tf.scale ?? 1) > ZOOM_EPS
  const selZoomPct = selSlot?.placement?.imageId ? Math.round((selSlot.placement.tf.scale ?? 1) * 100) : 0
  const selZoomed = selZoomPct > 100

  const splitCursor = activeSplit ? (activeSplit.dir === 'v' ? 'col-resize' : 'row-resize') : null
  const cursor =
    dragKind === 'image-pan' || dragKind === 'view' || dragKind === 'image-swap'
      ? 'grabbing'
      : dragKind === 'anno-move' || dragKind === 'anno-resize'
        ? 'move'
        : splitCursor
          ? splitCursor
          : tool !== 'select'
            ? 'crosshair'
            : hoverZoomed
              ? 'grab'
              : 'default'

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      // touch-action: none —— 触摸时交给我们的 pointer 逻辑处理，
      // 否则浏览器会把双指捏合当成「缩放整个页面」、单指拖动当成「滚动页面」
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={(e) => {
        pointersRef.current.delete(e.pointerId)
        if (pointersRef.current.size < 2) pinchRef.current = null
        setHoverSlot(null)
        setSplitHi(null)
      }}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} className="block" />

      {splitBar ? (
        <>
          {/* 分割线高亮 */}
          <div
            className="pointer-events-none absolute rounded-full bg-brand-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.9)]"
            style={splitBar.line}
          />
          {/* 中间拖拽手柄 */}
          <div
            className="pointer-events-none absolute grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-white shadow-lg ring-2 ring-white dark:ring-slate-900"
            style={{ left: splitBar.cx - 12, top: splitBar.cy - 12 }}
          >
            {splitBar.isV ? (
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 8 L6 12 L10 16" />
                <path d="M14 8 L18 12 L14 16" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 10 L12 6 L16 10" />
                <path d="M8 14 L12 18 L16 14" />
              </svg>
            )}
          </div>
        </>
      ) : null}

      {hoverRect && hoverSlot !== selectedSlotId ? (
        <div
          className="pointer-events-none absolute border-2 border-brand-400/80 bg-brand-400/10"
          style={boxScreen(hoverRect)}
        />
      ) : null}

      {selSlot ? (
        <div className="pointer-events-none absolute border-2 border-brand-500" style={boxScreen(selSlot.rect)}>
          {selSlot.placement?.imageId ? (
            <div className="pointer-events-auto absolute -top-9 left-0 flex items-center gap-1 rounded-lg bg-white/95 px-1.5 py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <button
                className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                title="缩小"
                onClick={() => setSlotTransform(selSlot.id, { scale: (selSlot.placement!.tf.scale ?? 1) * 0.9 })}
              >
                <span className="text-sm leading-none text-slate-700 dark:text-slate-200">−</span>
              </button>
              <span className="w-10 text-center font-mono text-[11px] text-slate-500">
                {Math.round((selSlot.placement!.tf.scale ?? 1) * 100)}%
              </span>
              <button
                className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                title="放大"
                onClick={() => setSlotTransform(selSlot.id, { scale: (selSlot.placement!.tf.scale ?? 1) * 1.1 })}
              >
                <IconPlus className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />
              </button>
              <button
                className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                title="复位"
                onClick={() => setSlotTransform(selSlot.id, { scale: 1, dx: 0, dy: 0 })}
              >
                <IconFit className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />
              </button>
              <button
                className="grid h-6 w-6 place-items-center rounded hover:bg-rose-50 dark:hover:bg-rose-950"
                title={mode === 'long' ? '从拼接中删除这张' : '移除该图'}
                onClick={() => {
                  const id = selSlot.placement?.imageId
                  if (!id) return
                  // 长图模式下「删除」= 真的从拼接条里去掉这张（后面的图自动前移）
                  if (mode === 'long') removeImage(id)
                  else setSlotImage(selSlot.id, null)
                }}
              >
                <IconTrash className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selected && selBounds ? (
        <>
          <div
            className="pointer-events-none absolute border border-dashed border-brand-500"
            style={boxScreen({ x: selBounds.x - 4, y: selBounds.y - 4, w: selBounds.w + 8, h: selBounds.h + 8 })}
          />
          {(selected.type === 'arrow'
            ? ([{ h: 'start' as Handle, x: selected.x1, y: selected.y1 }, { h: 'end' as Handle, x: selected.x2, y: selected.y2 }])
            : handlePositions(selBounds)
          ).map((hp) => {
            const sp = toScreen(hp.x, hp.y)
            return (
              <div
                key={hp.h}
                className="absolute h-2.5 w-2.5 rounded-sm border border-brand-600 bg-white shadow"
                style={{ left: sp.x - 5, top: sp.y - 5, cursor: CURSORS[hp.h] }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const el = wrapRef.current!
                  el.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'anno-resize', id: selected.id, handle: hp.h, start: selected, sx: 0, sy: 0 }
                  const p = toLogical(e.clientX, e.clientY)
                  dragRef.current = { kind: 'anno-resize', id: selected.id, handle: hp.h, start: selected, sx: p.x, sy: p.y }
                  setDragKind('anno-resize')
                }}
              />
            )
          })}
          <div
            className="absolute flex items-center gap-1 rounded-lg bg-white/95 px-1.5 py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
            style={{
              left: toScreen(selBounds.x, selBounds.y).x,
              top: Math.max(4, toScreen(selBounds.x, selBounds.y).y - 40),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="color"
              value={selected.type === 'text' ? selected.color : selected.color}
              onChange={(e) => updateAnnotation(selected.id, { color: e.target.value } as any)}
              className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent"
              title="颜色"
            />
            {selected.type === 'text' ? (
              <>
                <button
                  className="h-6 rounded px-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => updateAnnotation(selected.id, { bold: !selected.bold } as any)}
                  title="加粗"
                >
                  B
                </button>
                <button
                  className="h-6 rounded px-1.5 text-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => setEditingText({ id: selected.id, value: selected.text })}
                  title="编辑文字"
                >
                  编辑
                </button>
                <button
                  className="h-6 rounded px-1.5 text-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() =>
                    updateAnnotation(selected.id, { bg: selected.bg ? null : 'rgba(255,255,255,0.85)' } as any)
                  }
                  title="底色"
                >
                  底色
                </button>
              </>
            ) : null}
            {selected.type === 'arrow' || selected.type === 'rect' || selected.type === 'ellipse' ? (
              <>
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={selected.type === 'arrow' ? selected.width : (selected as any).strokeWidth}
                  onChange={(e) =>
                    updateAnnotation(
                      selected.id,
                      (selected.type === 'arrow' ? { width: Number(e.target.value) } : { strokeWidth: Number(e.target.value) }) as any,
                    )
                  }
                  className="w-16"
                  title="粗细"
                />
                {selected.type !== 'arrow' ? (
                  <input
                    type="color"
                    value={(selected as any).fill ?? '#ffffff'}
                    onChange={(e) => updateAnnotation(selected.id, { fill: e.target.value } as any)}
                    className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent"
                    title="填充"
                  />
                ) : null}
              </>
            ) : null}
            <button
              className="grid h-6 w-6 place-items-center rounded hover:bg-rose-50"
              onClick={() => removeAnnotation(selected.id)}
              title="删除"
            >
              <IconX className="h-3.5 w-3.5 text-rose-500" />
            </button>
          </div>
        </>
      ) : null}

      {editingText ? (
        <textarea
          autoFocus
          value={editingText.value}
          onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
          onBlur={() => {
            updateAnnotation(editingText.id, { text: editingText.value } as any)
            setEditingText(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditingText(null)
          }}
          className="absolute z-20 rounded-lg border-2 border-brand-500 bg-white/95 p-1 text-sm shadow-lg outline-none dark:bg-slate-800 dark:text-white"
          style={{
            left: toScreen(
              (annotations.find((a) => a.id === editingText.id) as any)?.x ?? 0,
              (annotations.find((a) => a.id === editingText.id) as any)?.y ?? 0,
            ).x,
            top: toScreen(
              (annotations.find((a) => a.id === editingText.id) as any)?.x ?? 0,
              (annotations.find((a) => a.id === editingText.id) as any)?.y ?? 0,
            ).y,
            width: 220,
            height: 90,
            fontSize: 14,
          }}
        />
      ) : null}

      {selZoomed ? (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[min(90%,26rem)] rounded-lg bg-slate-900/85 px-3 py-1.5 text-[11px] leading-5 text-white shadow-lg backdrop-blur">
          已放大 {selZoomPct}% · <b className="font-semibold">按住左键拖动</b>可调整显示区域 · 滚轮继续缩放 · Shift+拖动交换图片
        </div>
      ) : activeSplit ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-slate-900/85 px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur">
          拖动可调整两侧图片占比
        </div>
      ) : hoverZoomed && !selZoomed ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-slate-900/75 px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur">
          按住左键可拖动调整位置
        </div>
      ) : null}

      <div
        className="pointer-events-auto absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        title="滚轮缩放：光标在图片上缩放该图片，光标在空白处缩放整个画布"
      >
        <Button
          size="sm"
          variant="ghost"
          title="缩小画布"
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.2, v.zoom * 0.9) }))}
        >
          {/* 只放大符号本身，按钮尺寸保持不变 */}
          <span className="text-lg font-medium leading-none">−</span>
        </Button>
        <span className="w-12 text-center font-mono text-[11px] text-slate-500">{Math.round(view.zoom * 100)}%</span>
        <Button
          size="sm"
          variant="ghost"
          title="放大画布"
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.1) }))}
        >
          <span className="text-lg font-medium leading-none">+</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={fit} title="适应窗口">
          <IconFit className="h-3.5 w-3.5" />
        </Button>
      </div>

      {tool !== 'select' ? (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-brand-600/90 px-3 py-1 text-xs text-white shadow">
          {tool === 'text'
            ? '点击画布添加文字（添加后可双击编辑）'
            : tool === 'arrow'
              ? '按住拖动绘制箭头'
              : '按住拖动画出图形'}
        </div>
      ) : null}
    </div>
  )
}
