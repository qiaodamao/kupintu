'use client'

import { create } from 'zustand'
import type {
  Annotation,
  EditorMode,
  ImageAsset,
  LayoutNode,
  LongDirection,
  Placement,
  SlotTransform,
  StyleConfig,
  Tool,
} from './types'
import { DEFAULT_STYLE, DEFAULT_LONG_STYLE, BASE_W } from './types'
import {
  cloneTree,
  collectLeaves,
  countLeaves,
  genTemplates,
  setRatio as setTreeRatio,
  uid,
} from './layout'

export const MAX_IMAGES = 16

const defaultTf = (): SlotTransform => ({ scale: 1, dx: 0, dy: 0 })

/** 两种模式各自记住一份样式，切换时互不覆盖（长图默认 zero padding/radius） */
const styleByMode: Record<EditorMode, StyleConfig> = {
  grid: { ...DEFAULT_STYLE },
  long: { ...DEFAULT_LONG_STYLE },
}

interface Snapshot {
  tree: LayoutNode
  placements: Record<string, Placement>
  style: StyleConfig
  annotations: Annotation[]
}

export interface EditorState {
  mode: EditorMode
  longDir: LongDirection
  tool: Tool
  images: ImageAsset[]
  tree: LayoutNode
  placements: Record<string, Placement>
  style: StyleConfig
  annotations: Annotation[]
  selectedAnnoId: string | null
  selectedSlotId: string | null
  history: Snapshot[]
  future: Snapshot[]

  setMode: (mode: EditorMode) => void
  setLongDir: (dir: LongDirection) => void
  setTool: (tool: Tool) => void
  addFiles: (files: File[]) => Promise<void>
  removeImage: (id: string) => void
  clearImages: () => void
  reorderImages: (from: number, to: number) => void
  applyTemplate: (tree: LayoutNode) => void
  ensureTemplate: (count: number) => void
  setRatio: (id: string, ratio: number) => void
  swapSlots: (a: string, b: string) => void
  setSlotImage: (slotId: string, imageId: string | null) => void
  setSlotTransform: (slotId: string, tf: Partial<SlotTransform>) => void
  resetTransforms: () => void
  /** 开启事务：期间所有改动合并为一条撤销记录（用于拖动、连续滚轮） */
  beginTransaction: () => void
  endTransaction: () => void
  updateStyle: (patch: Partial<StyleConfig>) => void
  addAnnotation: (a: Annotation) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void
  selectAnnotation: (id: string | null) => void
  selectSlot: (id: string | null) => void
  undo: () => void
  redo: () => void
  resetAll: () => void
}

function snapshot(s: EditorState): Snapshot {
  return { tree: s.tree, placements: s.placements, style: s.style, annotations: s.annotations }
}

function initialTree(count: number): LayoutNode {
  return genTemplates(Math.max(1, Math.min(MAX_IMAGES, count)))[0].tree
}

export const useEditor = create<EditorState>((set, get) => {
  // 事务进行中时不重复入栈，避免拖动/滚轮把撤销栈刷爆
  let inTxn = false

  const commit = (patch: Partial<EditorState>) => {
    const s = get()
    if (inTxn) {
      set({ future: [], ...patch } as EditorState)
      return
    }
    set({
      history: [...s.history, snapshot(s)].slice(-30),
      future: [],
      ...patch,
    } as EditorState)
  }

  const fillPlacements = (
    tree: LayoutNode,
    images: ImageAsset[],
    prev: Record<string, Placement> = {},
  ): Record<string, Placement> => {
    const leaves = collectLeaves(tree)
    const prevTf = new Map<string, SlotTransform>()
    const prevSeq: string[] = []
    for (const p of Object.values(prev)) {
      if (p.imageId) {
        prevTf.set(p.imageId, p.tf)
        prevSeq.push(p.imageId)
      }
    }
    const used = new Set<string>()
    const out: Record<string, Placement> = {}
    const available = images.filter((i) => !prevSeq.includes(i.id) || used.has(i.id))
    let ai = 0
    leaves.forEach((leafId, idx) => {
      let imageId: string | null = null
      if (prevSeq[idx] && images.some((i) => i.id === prevSeq[idx])) {
        imageId = prevSeq[idx]
      } else {
        while (ai < available.length) {
          const cand = available[ai]
          ai += 1
          if (!used.has(cand.id)) {
            imageId = cand.id
            break
          }
        }
      }
      if (imageId) used.add(imageId)
      out[leafId] = { leafId, imageId, tf: imageId ? { ...(prevTf.get(imageId) ?? defaultTf()) } : defaultTf() }
    })
    return out
  }

  return {
    mode: 'grid',
    longDir: 'vertical',
    tool: 'select',
    images: [],
    tree: initialTree(1),
    placements: {},
    style: { ...DEFAULT_STYLE },
    annotations: [],
    selectedAnnoId: null,
    selectedSlotId: null,
    history: [],
    future: [],

    setMode: (mode) => {
      const s = get()
      if (mode === s.mode) return
      styleByMode[s.mode] = { ...s.style }
      const style = { ...styleByMode[mode] }
      if (mode === 'long') {
        const placements: Record<string, Placement> = {}
        for (const img of s.images) {
          placements[img.id] = s.placements[img.id] ?? { leafId: img.id, imageId: img.id, tf: defaultTf() }
        }
        set({ mode, style, placements, selectedSlotId: null })
      } else {
        set({ mode, style, selectedSlotId: null })
      }
    },
    setLongDir: (longDir) => set({ longDir }),
    setTool: (tool) => set({ tool, selectedAnnoId: tool === 'select' ? get().selectedAnnoId : null }),

    addFiles: async (files) => {
      const list = files.filter((f) => f.type.startsWith('image/')).slice(0, MAX_IMAGES * 2)
      if (!list.length) return
      const loaded: ImageAsset[] = []
      for (const file of list) {
        const url = URL.createObjectURL(file)
        const dim = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
          img.onerror = () => resolve({ width: 1, height: 1 })
          img.src = url
        })
        loaded.push({ id: uid('img'), name: file.name || 'image', url, width: dim.width, height: dim.height })
      }
      const s = get()
      const images = [...s.images, ...loaded].slice(0, MAX_IMAGES)
      const overflow = [...s.images, ...loaded].slice(MAX_IMAGES)
      overflow.forEach((i) => URL.revokeObjectURL(i.url))
      const count = Math.max(1, Math.min(MAX_IMAGES, images.length))
      let tree = s.tree
      if (countLeaves(tree) !== count) tree = genTemplates(count)[0].tree
      const placements = fillPlacements(tree, images, s.placements)
      // 长图模式下 placement 以图片 id 为键
      if (s.mode === 'long') {
        for (const img of images) {
          if (!placements[img.id]) placements[img.id] = { leafId: img.id, imageId: img.id, tf: defaultTf() }
        }
      }
      commit({ images, tree, placements })
    },

    removeImage: (id) => {
      const s = get()
      const images = s.images.filter((i) => i.id !== id)
      const target = s.images.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.url)
      const placements: Record<string, Placement> = {}
      for (const [k, p] of Object.entries(s.placements)) {
        placements[k] = p.imageId === id ? { ...p, imageId: null, tf: defaultTf() } : p
      }
      const count = Math.max(1, Math.min(MAX_IMAGES, images.length))
      let tree = s.tree
      if (s.mode === 'grid' && countLeaves(tree) !== count) tree = genTemplates(count)[0].tree
      if (s.mode === 'grid') Object.assign(placements, fillPlacements(tree, images, placements))
      commit({ images, placements, tree })
    },

    clearImages: () => {
      const s = get()
      s.images.forEach((i) => URL.revokeObjectURL(i.url))
      commit({
        images: [],
        placements: {},
        annotations: [],
        tree: initialTree(1),
        selectedAnnoId: null,
        selectedSlotId: null,
      })
    },

    reorderImages: (from, to) => {
      const s = get()
      if (from === to) return
      const images = [...s.images]
      const [item] = images.splice(from, 1)
      if (!item) return
      images.splice(to, 0, item)
      commit({ images })
    },

    applyTemplate: (tree) => {
      const s = get()
      const next = cloneTree(tree)
      commit({ tree: next, placements: fillPlacements(next, s.images, s.placements) })
    },

    ensureTemplate: (count) => {
      const s = get()
      const n = Math.max(1, Math.min(MAX_IMAGES, count))
      if (countLeaves(s.tree) === n) return
      const next = genTemplates(n)[0].tree
      commit({ tree: next, placements: fillPlacements(next, s.images, s.placements) })
    },

    setRatio: (id, ratio) => {
      const s = get()
      commit({ tree: setTreeRatio(s.tree, id, ratio) })
    },

    swapSlots: (a, b) => {
      const s = get()
      const pa = s.placements[a]
      const pb = s.placements[b]
      if (!pa && !pb) return
      const placements = { ...s.placements }
      placements[a] = { leafId: a, imageId: pb?.imageId ?? null, tf: pb?.tf ?? defaultTf() }
      placements[b] = { leafId: b, imageId: pa?.imageId ?? null, tf: pa?.tf ?? defaultTf() }
      commit({ placements })
    },

    setSlotImage: (slotId, imageId) => {
      const s = get()
      const placements = { ...s.placements }
      // 若该图已在其他格子，先移除
      if (imageId) {
        for (const [k, p] of Object.entries(placements)) {
          if (k !== slotId && p.imageId === imageId) placements[k] = { ...p, imageId: null, tf: defaultTf() }
        }
      }
      placements[slotId] = { leafId: slotId, imageId, tf: imageId ? defaultTf() : defaultTf() }
      commit({ placements })
    },

    setSlotTransform: (slotId, tf) => {
      const s = get()
      const cur = s.placements[slotId] ?? { leafId: slotId, imageId: null, tf: defaultTf() }
      const nextTf = { ...cur.tf, ...tf }
      nextTf.scale = Math.max(0.2, Math.min(6, nextTf.scale))
      commit({ placements: { ...s.placements, [slotId]: { ...cur, tf: nextTf } } })
    },

    resetTransforms: () => {
      const s = get()
      const placements: Record<string, Placement> = {}
      for (const [k, p] of Object.entries(s.placements)) placements[k] = { ...p, tf: defaultTf() }
      commit({ placements })
    },

    beginTransaction: () => {
      const s = get()
      set({ history: [...s.history, snapshot(s)].slice(-30), future: [] })
      inTxn = true
    },
    endTransaction: () => {
      inTxn = false
    },

    updateStyle: (patch) => {
      const s = get()
      commit({ style: { ...s.style, ...patch } })
    },

    addAnnotation: (a) => {
      const s = get()
      commit({ annotations: [...s.annotations, a], selectedAnnoId: a.id, tool: 'select' })
    },

    updateAnnotation: (id, patch) => {
      const s = get()
      commit({
        annotations: s.annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
      })
    },

    removeAnnotation: (id) => {
      const s = get()
      commit({
        annotations: s.annotations.filter((a) => a.id !== id),
        selectedAnnoId: s.selectedAnnoId === id ? null : s.selectedAnnoId,
      })
    },

    selectAnnotation: (id) => set({ selectedAnnoId: id, selectedSlotId: id ? null : get().selectedSlotId }),
    selectSlot: (id) => set({ selectedSlotId: id, selectedAnnoId: id ? null : get().selectedAnnoId }),

    undo: () => {
      const s = get()
      const prev = s.history[s.history.length - 1]
      if (!prev) return
      set({
        history: s.history.slice(0, -1),
        future: [snapshot(s), ...s.future].slice(0, 30),
        ...prev,
      })
    },
    redo: () => {
      const s = get()
      const next = s.future[0]
      if (!next) return
      set({
        future: s.future.slice(1),
        history: [...s.history, snapshot(s)].slice(-30),
        ...next,
      })
    },

    resetAll: () => {
      const s = get()
      s.images.forEach((i) => URL.revokeObjectURL(i.url))
      commit({
        images: [],
        placements: {},
        annotations: [],
        tree: initialTree(1),
        style: { ...styleByMode[s.mode] },
        selectedAnnoId: null,
        selectedSlotId: null,
      })
    },
  }
})

export { BASE_W }
