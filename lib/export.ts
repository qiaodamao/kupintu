import { drawScene } from './render'
import type { DrawOptions } from './render'

export type ExportFormat = 'png' | 'jpeg' | 'webp'
export type ScaleMode = '1x' | '2x' | '3x' | '4k'

export interface ExportOptions {
  format: ExportFormat
  scaleMode: ScaleMode
  customWidth?: number
  quality: number
  transparent: boolean
}

export const MAX_EDGE = 8192

export function targetWidth(base: number, mode: ScaleMode, customWidth?: number): number {
  switch (mode) {
    case '1x':
      return Math.round(base)
    case '2x':
      return Math.round(base * 2)
    case '3x':
      return Math.round(base * 3)
    case '4k':
      return Math.round(Math.min(MAX_EDGE, Math.max(base, 3840)))
    default:
      return Math.round(customWidth ?? base)
  }
}

export async function renderToBlob(
  scene: Omit<DrawOptions, 'scale' | 'preview' | 'selectedAnnoId' | 'transparent'>,
  opts: ExportOptions,
): Promise<{ blob: Blob; width: number; height: number }> {
  const width = targetWidth(scene.width, opts.scaleMode, opts.customWidth)
  const scale = width / scene.width
  const height = Math.round(scene.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(MAX_EDGE, width)
  canvas.height = Math.min(MAX_EDGE, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.scale(scale, scale)
  // JPEG 没有 alpha 通道，只能填白；PNG / WebP 支持透明
  drawScene(ctx, { ...scene, scale, transparent: opts.transparent && opts.format !== 'jpeg' })
  const mime = opts.format === 'png' ? 'image/png' : opts.format === 'webp' ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, opts.quality))
  if (!blob) throw new Error('导出失败，请尝试降低分辨率')
  return { blob, width: canvas.width, height: canvas.height }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
