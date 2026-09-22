import type { LayoutNode, Rect, SplitDir } from './types'

let seed = 0
export function uid(prefix = 'n'): string {
  seed += 1
  return `${prefix}${Date.now().toString(36)}${seed.toString(36)}${Math.floor(
    Math.random() * 1e4,
  ).toString(36)}`
}

/** 克隆树并赋予新的节点 id（用于模板实例化） */
export function cloneTree(node: LayoutNode): LayoutNode {
  if (node.kind === 'leaf') return { id: uid('l'), kind: 'leaf' }
  return {
    id: uid('s'),
    kind: 'split',
    dir: node.dir,
    ratio: node.ratio,
    a: cloneTree(node.a),
    b: cloneTree(node.b),
  }
}

/* ------------------------------------------------------------------ */
/* 模板生成：递归二分                                                   */
/* ------------------------------------------------------------------ */

interface Plan {
  name: string
  dir: 'auto' | SplitDir
  mode: 'half' | 'one'
  ratio: 'equal' | 'golden' | 'hero' | 'third'
  heroSide?: 'a' | 'b'
}

const PLANS: Plan[] = [
  { name: '智能网格', dir: 'auto', mode: 'half', ratio: 'equal' },
  { name: '纵向均分', dir: 'v', mode: 'half', ratio: 'equal' },
  { name: '横向均分', dir: 'h', mode: 'half', ratio: 'equal' },
  { name: '黄金比例', dir: 'auto', mode: 'half', ratio: 'golden', heroSide: 'b' },
  { name: '黄金反转', dir: 'auto', mode: 'half', ratio: 'golden', heroSide: 'a' },
  { name: '左一右多', dir: 'v', mode: 'one', ratio: 'hero', heroSide: 'a' },
  { name: '左多右一', dir: 'v', mode: 'one', ratio: 'hero', heroSide: 'b' },
  { name: '上一下多', dir: 'h', mode: 'one', ratio: 'hero', heroSide: 'a' },
  { name: '上多下一', dir: 'h', mode: 'one', ratio: 'hero', heroSide: 'b' },
  { name: '三分法', dir: 'auto', mode: 'half', ratio: 'third', heroSide: 'a' },
]

function buildTree(n: number, rect: Rect, plan: Plan, depth = 0): LayoutNode {
  if (n <= 1) return { id: uid('l'), kind: 'leaf' }
  // 主次比例只在首层生效，子区域始终等比细分，避免出现趋近于零的窄格
  const p: Plan =
    depth === 0 ? plan : { name: plan.name, dir: 'auto', mode: 'half', ratio: 'equal', heroSide: 'a' }
  const dir: SplitDir = p.dir === 'auto' ? (rect.w >= rect.h ? 'v' : 'h') : p.dir
  const k = p.mode === 'one' ? 1 : Math.floor(n / 2)
  const ka = Math.max(1, Math.min(n - 1, k))
  let ratio: number
  switch (p.ratio) {
    case 'golden':
      ratio = p.heroSide === 'a' ? 0.618 : 0.382
      break
    case 'hero':
      ratio = p.heroSide === 'a' ? 0.62 : 0.38
      break
    case 'third':
      ratio = 0.36
      break
    default:
      ratio = ka / n
  }
  const ra = dir === 'v' ? { x: rect.x, y: rect.y, w: rect.w * ratio, h: rect.h } : { x: rect.x, y: rect.y, w: rect.w, h: rect.h * ratio }
  const rb =
    dir === 'v'
      ? { x: rect.x + rect.w * ratio, y: rect.y, w: rect.w * (1 - ratio), h: rect.h }
      : { x: rect.x, y: rect.y + rect.h * ratio, w: rect.w, h: rect.h * (1 - ratio) }
  return {
    id: uid('s'),
    kind: 'split',
    dir,
    ratio,
    a: buildTree(ka, ra, plan, depth + 1),
    b: buildTree(n - ka, rb, plan, depth + 1),
  }
}

export interface Template {
  id: string
  name: string
  count: number
  tree: LayoutNode
}

function signature(node: LayoutNode): string {
  if (node.kind === 'leaf') return 'L'
  const r = Math.round(node.ratio * 100)
  return `${node.dir}${r}(${signature(node.a)},${signature(node.b)})`
}

const cache = new Map<number, Template[]>()

/** 生成指定图片数量的所有布局模板（1~16） */
export function genTemplates(count: number): Template[] {
  const n = Math.max(1, Math.min(16, count))
  const hit = cache.get(n)
  if (hit) return hit
  const seen = new Set<string>()
  const list: Template[] = []
  const root: Rect = { x: 0, y: 0, w: 1, h: 1 }
  for (const plan of PLANS) {
    const tree = buildTree(n, root, plan)
    const sig = signature(tree)
    if (seen.has(sig)) continue
    seen.add(sig)
    list.push({ id: `${n}-${list.length}`, name: count === 1 ? '单图' : `${n}图 · ${plan.name}`, count: n, tree })
  }
  cache.set(n, list)
  return list
}

/* ------------------------------------------------------------------ */
/* 布局计算                                                            */
/* ------------------------------------------------------------------ */

export function collectLeaves(node: LayoutNode, out: string[] = []): string[] {
  if (node.kind === 'leaf') out.push(node.id)
  else {
    collectLeaves(node.a, out)
    collectLeaves(node.b, out)
  }
  return out
}

export function countLeaves(node: LayoutNode): number {
  return node.kind === 'leaf' ? 1 : countLeaves(node.a) + countLeaves(node.b)
}

/** 计算每个叶子在容器内的实际矩形（扣除间距） */
export function computeRects(
  node: LayoutNode,
  rect: Rect,
  gap: number,
  out: Map<string, Rect> = new Map(),
): Map<string, Rect> {
  if (node.kind === 'leaf') {
    out.set(node.id, rect)
    return out
  }
  const ratio = Math.max(0.08, Math.min(0.92, node.ratio))
  if (node.dir === 'v') {
    const total = Math.max(0, rect.w - gap)
    const aw = total * ratio
    computeRects(node.a, { x: rect.x, y: rect.y, w: aw, h: rect.h }, gap, out)
    computeRects(node.b, { x: rect.x + aw + gap, y: rect.y, w: total - aw, h: rect.h }, gap, out)
  } else {
    const total = Math.max(0, rect.h - gap)
    const ah = total * ratio
    computeRects(node.a, { x: rect.x, y: rect.y, w: rect.w, h: ah }, gap, out)
    computeRects(node.b, { x: rect.x, y: rect.y + ah + gap, w: rect.w, h: total - ah }, gap, out)
  }
  return out
}

export function findLeafAt(tree: LayoutNode, rect: Rect, gap: number, x: number, y: number): string | null {
  const rects = computeRects(tree, rect, gap)
  for (const [id, r] of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id
  }
  return null
}

export interface SplitHit {
  id: string
  dir: SplitDir
  /** 分割线所在位置（垂直于 dir 的坐标） */
  pos: number
  start: number
  end: number
}

/** 命中检测：找出距离给定点最近的分割线 */
export function findSplitAt(
  node: LayoutNode,
  rect: Rect,
  gap: number,
  x: number,
  y: number,
  tol: number,
): SplitHit | null {
  let best: SplitHit | null = null
  let bestDist = Infinity
  const walk = (n: LayoutNode, r: Rect) => {
    if (n.kind === 'leaf') return
    const ratio = Math.max(0.08, Math.min(0.92, n.ratio))
    let pos: number
    let start: number
    let end: number
    if (n.dir === 'v') {
      const total = Math.max(0, r.w - gap)
      pos = r.x + total * ratio + gap / 2
      start = r.y
      end = r.y + r.h
    } else {
      const total = Math.max(0, r.h - gap)
      pos = r.y + total * ratio + gap / 2
      start = r.x
      end = r.x + r.w
    }
    const within = n.dir === 'v' ? y >= start - tol && y <= end + tol : x >= start - tol && x <= end + tol
    const dist = n.dir === 'v' ? Math.abs(x - pos) : Math.abs(y - pos)
    if (within && dist <= tol && dist < bestDist) {
      bestDist = dist
      best = { id: n.id, dir: n.dir, pos, start, end }
    }
    if (n.dir === 'v') {
      const total = Math.max(0, r.w - gap)
      const aw = total * ratio
      walk(n.a, { x: r.x, y: r.y, w: aw, h: r.h })
      walk(n.b, { x: r.x + aw + gap, y: r.y, w: total - aw, h: r.h })
    } else {
      const total = Math.max(0, r.h - gap)
      const ah = total * ratio
      walk(n.a, { x: r.x, y: r.y, w: r.w, h: ah })
      walk(n.b, { x: r.x, y: r.y + ah + gap, w: r.w, h: total - ah })
    }
  }
  walk(node, rect)
  return best
}

/** 按 id 取分割线的实时几何（拖动过程中比例变化后位置会跟着变） */
export function splitGeomAt(node: LayoutNode, id: string, rect: Rect, gap: number): SplitHit | null {
  if (node.kind === 'leaf') return null
  const ratio = Math.max(0.08, Math.min(0.92, node.ratio))
  if (node.id === id) {
    if (node.dir === 'v') {
      const total = Math.max(0, rect.w - gap)
      return { id, dir: node.dir, pos: rect.x + total * ratio + gap / 2, start: rect.y, end: rect.y + rect.h }
    }
    const total = Math.max(0, rect.h - gap)
    return { id, dir: node.dir, pos: rect.y + total * ratio + gap / 2, start: rect.x, end: rect.x + rect.w }
  }
  if (node.dir === 'v') {
    const total = Math.max(0, rect.w - gap)
    const aw = total * ratio
    return (
      splitGeomAt(node.a, id, { x: rect.x, y: rect.y, w: aw, h: rect.h }, gap) ??
      splitGeomAt(node.b, id, { x: rect.x + aw + gap, y: rect.y, w: total - aw, h: rect.h }, gap)
    )
  }
  const total = Math.max(0, rect.h - gap)
  const ah = total * ratio
  return (
    splitGeomAt(node.a, id, { x: rect.x, y: rect.y, w: rect.w, h: ah }, gap) ??
    splitGeomAt(node.b, id, { x: rect.x, y: rect.y + ah + gap, w: rect.w, h: total - ah }, gap)
  )
}

/** 修改某个分割节点的比例 */
export function setRatio(node: LayoutNode, id: string, ratio: number): LayoutNode {
  if (node.kind === 'leaf') return node
  if (node.id === id) return { ...node, ratio: Math.max(0.08, Math.min(0.92, ratio)) }
  return { ...node, a: setRatio(node.a, id, ratio), b: setRatio(node.b, id, ratio) }
}

/** 计算某个分割节点对应的容器矩形（用于拖动换算） */
export function rectOfNode(node: LayoutNode, id: string, rect: Rect, gap: number): Rect | null {
  if (node.id === id) return rect
  if (node.kind === 'leaf') return null
  const ratio = Math.max(0.08, Math.min(0.92, node.ratio))
  if (node.dir === 'v') {
    const total = Math.max(0, rect.w - gap)
    const aw = total * ratio
    return (
      rectOfNode(node.a, id, { x: rect.x, y: rect.y, w: aw, h: rect.h }, gap) ??
      rectOfNode(node.b, id, { x: rect.x + aw + gap, y: rect.y, w: total - aw, h: rect.h }, gap)
    )
  }
  const total = Math.max(0, rect.h - gap)
  const ah = total * ratio
  return (
    rectOfNode(node.a, id, { x: rect.x, y: rect.y, w: rect.w, h: ah }, gap) ??
    rectOfNode(node.b, id, { x: rect.x, y: rect.y + ah + gap, w: rect.w, h: total - ah }, gap)
  )
}
