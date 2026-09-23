/** 逻辑画布基准宽度（所有样式数值都以此为基准，导出时整体缩放） */
export const BASE_W = 1200

export type SplitDir = 'v' | 'h'

export interface LeafNode {
  id: string
  kind: 'leaf'
}
export interface SplitNode {
  id: string
  kind: 'split'
  dir: SplitDir
  /** 第一块（a）占比 0~1 */
  ratio: number
  a: LayoutNode
  b: LayoutNode
}
export type LayoutNode = LeafNode | SplitNode

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ImageAsset {
  id: string
  name: string
  url: string
  width: number
  height: number
}

/** 单张图片在格子内的变换 */
export interface SlotTransform {
  scale: number
  dx: number
  dy: number
}

export interface Placement {
  leafId: string
  imageId: string | null
  tf: SlotTransform
}

export interface Background {
  type: 'solid' | 'gradient' | 'transparent'
  color: string
  color2: string
  angle: number
}

export interface StyleConfig {
  gap: number
  padding: number
  radius: number
  background: Background
  /** 画布宽高比 w/h */
  aspect: number
  shadow: boolean
  /** 图片描边 */
  stroke: number
  strokeColor: string
}

export interface TextAnnotation {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
  color: string
  fontSize: number
  bold: boolean
  bg: string | null
  align: 'left' | 'center' | 'right'
}

export interface ArrowAnnotation {
  id: string
  type: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
  dashed: boolean
}

export interface ShapeAnnotation {
  id: string
  type: 'rect' | 'ellipse'
  x: number
  y: number
  w: number
  h: number
  color: string
  fill: string | null
  strokeWidth: number
  radius: number
  dashed: boolean
}

export type Annotation = TextAnnotation | ArrowAnnotation | ShapeAnnotation

export type EditorMode = 'grid' | 'long'
export type LongDirection = 'vertical' | 'horizontal'
export type Tool = 'select' | 'text' | 'arrow' | 'rect' | 'ellipse'

export interface Scene {
  mode: EditorMode
  longDir: LongDirection
  tree: LayoutNode
  placements: Record<string, Placement>
  images: Record<string, ImageAsset>
  order: string[]
  style: StyleConfig
  annotations: Annotation[]
  width: number
  height: number
}

/** 布局模式单画布最多支持的图片数（长图拼接不受此限制） */
export const MAX_IMAGES = 30

/** 长图拼接每行 / 每列最多容纳的图片数（1 = 原来的单排拼接） */
export const MAX_LONG_COLS = 8

export const DEFAULT_STYLE: StyleConfig = {
  gap: 12,
  padding: 16,
  radius: 12,
  background: { type: 'solid', color: '#ffffff', color2: '#a78bfa', angle: 135 },
  aspect: 1,
  shadow: false,
  stroke: 0,
  strokeColor: '#ffffff',
}

/** 长图拼接默认无缝：不留边距、不加圆角 */
export const DEFAULT_LONG_STYLE: StyleConfig = {
  ...DEFAULT_STYLE,
  padding: 0,
  radius: 0,
}

export const FONT_STACK =
  '-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif'
