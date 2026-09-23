import { BASE_W, FONT_STACK } from './types'
import type {
  Annotation,
  ArrowAnnotation,
  ImageAsset,
  LayoutNode,
  LongDirection,
  Placement,
  Rect,
  ShapeAnnotation,
  SlotTransform,
  StyleConfig,
  TextAnnotation,
} from './types'
import { computeRects } from './layout'

export interface Slot {
  id: string
  rect: Rect
  placement?: Placement
}

export interface DrawOptions {
  slots: Slot[]
  images: Record<string, ImageAsset>
  getImage: (url: string) => HTMLImageElement | undefined
  style: StyleConfig
  annotations: Annotation[]
  width: number
  height: number
  /** 导出缩放倍率，预览时为视图缩放 */
  scale: number
  /** 是否绘制占位框与选中态等辅助 UI */
  preview?: boolean
  selectedAnnoId?: string | null
  transparent?: boolean
}

/** sub=true 时不调用 beginPath，用于把圆角矩形追加为当前路径的子路径（evenodd 裁剪用） */
export function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number, sub = false) {
  const rad = Math.max(0, Math.min(radius, Math.min(r.w, r.h) / 2))
  if (!sub) ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(r.x, r.y, r.w, r.h, rad)
  } else {
    ctx.moveTo(r.x + rad, r.y)
    ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad)
    ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad)
    ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad)
    ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad)
    ctx.closePath()
  }
}

export function getTextSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  bold: boolean,
): { w: number; h: number } {
  ctx.save()
  ctx.font = `${bold ? '700 ' : ''}${fontSize}px ${FONT_STACK}`
  const lines = text.split('\n')
  let w = 0
  for (const line of lines) w = Math.max(w, ctx.measureText(line || ' ').width)
  ctx.restore()
  return { w: Math.max(w, fontSize * 0.6), h: lines.length * fontSize * 1.25 }
}

export function annotationBounds(ctx: CanvasRenderingContext2D, a: Annotation): Rect {
  switch (a.type) {
    case 'text': {
      const { w, h } = getTextSize(ctx, a.text, a.fontSize, a.bold)
      const pad = a.fontSize * 0.28
      return { x: a.x - pad, y: a.y - pad * 0.6, w: w + pad * 2, h: h + pad * 1.2 }
    }
    case 'arrow':
      return {
        x: Math.min(a.x1, a.x2),
        y: Math.min(a.y1, a.y2),
        w: Math.abs(a.x2 - a.x1),
        h: Math.abs(a.y2 - a.y1),
      }
    default:
      return { x: a.x, y: a.y, w: a.w, h: a.h }
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  const { style, width, height, transparent } = o
  const bg = style.background
  // 导出勾选「透明背景」时优先级最高：不管样式背景是纯色 / 渐变 / 透明，都不铺底
  // （调用方只会给支持 alpha 的格式传 transparent，JPG 仍走下面填白）
  if (transparent) return
  if (bg.type === 'transparent') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    return
  }
  if (bg.type === 'gradient') {
    const rad = ((bg.angle - 90) * Math.PI) / 180
    const cx = width / 2
    const cy = height / 2
    const len = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))
    const g = ctx.createLinearGradient(
      cx - (Math.cos(rad) * len) / 2,
      cy - (Math.sin(rad) * len) / 2,
      cx + (Math.cos(rad) * len) / 2,
      cy + (Math.sin(rad) * len) / 2,
    )
    g.addColorStop(0, bg.color)
    g.addColorStop(1, bg.color2)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = bg.color
  }
  ctx.fillRect(0, 0, width, height)
}

function drawImageSlot(ctx: CanvasRenderingContext2D, o: DrawOptions, slot: Slot) {
  const r = slot.rect
  const { style } = o
  const p = slot.placement
  const asset = p?.imageId ? o.images[p.imageId] : undefined
  const img = asset ? o.getImage(asset.url) : undefined

  if (!asset || !img) {
    // 占位
    ctx.save()
    roundRectPath(ctx, r, style.radius)
    ctx.fillStyle = 'rgba(148,163,184,0.14)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(148,163,184,0.55)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([8, 6])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(100,116,139,0.85)'
    ctx.font = `${Math.max(13, Math.min(30, r.h * 0.13))}px ${FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('拖入图片', r.x + r.w / 2, r.y + r.h / 2)
    ctx.restore()
    return
  }

  const tf: SlotTransform = p?.tf ?? { scale: 1, dx: 0, dy: 0 }
  if (style.shadow) {
    ctx.save()
    if (o.transparent) {
      // 透明导出：阴影衬底会露出白色，所以把绘制范围裁到圆角矩形「之外」（evenodd），
      // 只让投影落在图片外侧，衬底本身不会盖住图片（透明 PNG 才不会变白底）
      ctx.beginPath()
      ctx.rect(0, 0, o.width, o.height)
      roundRectPath(ctx, r, style.radius, true)
      ctx.clip('evenodd')
    }
    ctx.shadowColor = 'rgba(15,23,42,0.28)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    ctx.fillStyle = '#ffffff'
    roundRectPath(ctx, r, style.radius)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  roundRectPath(ctx, r, style.radius)
  ctx.clip()
  const base = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight)
  const s = base * tf.scale
  const w = img.naturalWidth * s
  const h = img.naturalHeight * s
  const x = r.x + (r.w - w) / 2 + tf.dx
  const y = r.y + (r.h - h) / 2 + tf.dy
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()

  if (style.stroke > 0) {
    ctx.save()
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = style.stroke
    roundRectPath(ctx, { x: r.x + style.stroke / 2, y: r.y + style.stroke / 2, w: r.w - style.stroke, h: r.h - style.stroke }, style.radius)
    ctx.stroke()
    ctx.restore()
  }
}

function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation, selected: boolean) {
  ctx.save()
  if (a.type === 'text') {
    const t = a as TextAnnotation
    ctx.font = `${t.bold ? '700 ' : ''}${t.fontSize}px ${FONT_STACK}`
    ctx.textBaseline = 'top'
    ctx.textAlign = t.align
    const lines = t.text.split('\n')
    const lh = t.fontSize * 1.25
    if (t.bg) {
      const { w, h } = getTextSize(ctx, t.text, t.fontSize, t.bold)
      const pad = t.fontSize * 0.28
      ctx.fillStyle = t.bg
      roundRectPath(ctx, { x: t.x - pad, y: t.y - pad * 0.6, w: w + pad * 2, h: h + pad * 1.2 }, t.fontSize * 0.22)
      ctx.fill()
    }
    ctx.fillStyle = t.color
    lines.forEach((line, i) => {
      const offset = t.align === 'center' ? 0 : t.align === 'right' ? 0 : 0
      ctx.fillText(line, t.x + offset, t.y + i * lh)
    })
  } else if (a.type === 'arrow') {
    const t = a as ArrowAnnotation
    ctx.strokeStyle = t.color
    ctx.fillStyle = t.color
    ctx.lineWidth = t.width
    ctx.lineCap = 'round'
    if (t.dashed) ctx.setLineDash([t.width * 3.2, t.width * 2.2])
    ctx.beginPath()
    ctx.moveTo(t.x1, t.y1)
    ctx.lineTo(t.x2, t.y2)
    ctx.stroke()
    ctx.setLineDash([])
    const ang = Math.atan2(t.y2 - t.y1, t.x2 - t.x1)
    const head = Math.max(12, t.width * 4)
    ctx.beginPath()
    ctx.moveTo(t.x2, t.y2)
    ctx.lineTo(t.x2 - head * Math.cos(ang - 0.42), t.y2 - head * Math.sin(ang - 0.42))
    ctx.lineTo(t.x2 - head * Math.cos(ang + 0.42), t.y2 - head * Math.sin(ang + 0.42))
    ctx.closePath()
    ctx.fill()
  } else {
    const t = a as ShapeAnnotation
    ctx.strokeStyle = t.color
    ctx.lineWidth = t.strokeWidth
    if (t.dashed) ctx.setLineDash([t.strokeWidth * 3.2, t.strokeWidth * 2.2])
    if (t.fill) {
      ctx.fillStyle = t.fill
      if (t.type === 'rect') {
        roundRectPath(ctx, t, t.radius)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.ellipse(t.x + t.w / 2, t.y + t.h / 2, Math.abs(t.w / 2), Math.abs(t.h / 2), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    } else if (t.type === 'rect') {
      roundRectPath(ctx, t, t.radius)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(t.x + t.w / 2, t.y + t.h / 2, Math.abs(t.w / 2), Math.abs(t.h / 2), 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }
  if (selected) {
    const b = annotationBounds(ctx, a)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8)
    ctx.setLineDash([])
  }
  ctx.restore()
}

/** 主绘制入口：ctx 需已按 scale 设置好变换 */
export function drawScene(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  drawBackground(ctx, o)
  for (const slot of o.slots) drawImageSlot(ctx, o, slot)
  for (const a of o.annotations) drawAnnotation(ctx, a, o.selectedAnnoId === a.id)
}

/* ------------------------------------------------------------------ */
/* 尺寸与槽位计算                                                      */
/* ------------------------------------------------------------------ */

export function gridCanvasSize(aspect: number): { width: number; height: number } {
  const width = BASE_W
  const height = Math.round(width / Math.max(0.2, Math.min(5, aspect)))
  return { width, height }
}

export function gridSlots(
  tree: LayoutNode,
  style: StyleConfig,
  width: number,
  height: number,
  placements: Record<string, Placement>,
): Slot[] {
  const inner: Rect = {
    x: style.padding,
    y: style.padding,
    w: Math.max(1, width - style.padding * 2),
    h: Math.max(1, height - style.padding * 2),
  }
  const rects = computeRects(tree, inner, style.gap)
  const slots: Slot[] = []
  for (const [id, rect] of rects) slots.push({ id, rect, placement: placements[id] })
  return slots
}

export interface LongLayout {
  width: number
  height: number
  slots: Slot[]
}

/** 长图拼接：横向按高度对齐，纵向按宽度对齐 */
export function longLayout(
  order: string[],
  images: Record<string, ImageAsset>,
  style: StyleConfig,
  dir: LongDirection,
  placements: Record<string, Placement>,
): LongLayout {
  const items = order.map((id) => images[id]).filter(Boolean) as ImageAsset[]
  const slots: Slot[] = []
  const pad = style.padding
  const gap = style.gap
  if (items.length === 0) {
    return { width: BASE_W, height: Math.round(BASE_W / style.aspect), slots }
  }
  if (dir === 'vertical') {
    const cw = BASE_W - pad * 2
    let y = pad
    for (const img of items) {
      const h = (cw * img.height) / img.width
      slots.push({ id: img.id, rect: { x: pad, y, w: cw, h }, placement: placements[img.id] })
      y += h + gap
    }
    return { width: BASE_W, height: Math.round(y - gap + pad), slots }
  }
  const ch = Math.round(BASE_W / 1.4) - pad * 2
  let x = pad
  for (const img of items) {
    const w = (ch * img.width) / img.height
    slots.push({ id: img.id, rect: { x, y: pad, w, h: ch }, placement: placements[img.id] })
    x += w + gap
  }
  return { width: Math.round(x - gap + pad), height: Math.round(ch + pad * 2), slots }
}
