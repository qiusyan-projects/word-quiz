import type { Mark, OrderId, RangeId, Word } from './types'

/** 词频键：缺失排到最后 */
export const freqKey = (w: Word) => (w.f > 0 ? w.f : 99999)

/**
 * 优先级：初中基础 → 高中（课标/星火/共识）→ 四六级衔接
 * pri 字段缺失时回退到 tier
 */
export const priKey = (w: Word) =>
  typeof w.pri === 'number' ? w.pri : w.bs ? 0 : (w.tier || 9)

export const PRI_NAMES = [
  '初中基础',
  '高中·课标',
  '高中·词书',
  '高中·共识',
  'CET4 衔接',
  'CET6 衔接',
]

export const priName = (w: Word) => PRI_NAMES[priKey(w)] ?? '其它'

/** 按测试范围筛选出词索引 */
export function baseIdx(words: Word[], range: RangeId): number[] {
  const out: number[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const lv = w.lv || ''
    if (range === 'core' && w.core !== 1) continue
    if (range === 'gk688' && !w.gk) continue
    if (range === 'cs' && lv.indexOf('课标') < 0) continue
    if (range === 'junior' && !w.bs) continue
    if (range === 'senior' && w.bs) continue
    if (range === 'bridge' && lv.indexOf('CET') < 0) continue
    out.push(i)
  }
  return out
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 生成测试序列
 * @param mode normal 按起始位置截断 | weak 只取已标记「不会」的词
 */
export function buildList(
  words: Word[],
  range: RangeId,
  order: OrderId,
  start: number,
  mode: 'normal' | 'weak',
  ans: Record<number, Mark>,
): number[] {
  const all = baseIdx(words, range)
  let list: number[]

  if (mode === 'weak') {
    list = all.filter((i) => ans[i] === 0)
  } else {
    const s = Math.max(0, (start || 1) - 1)
    list = order === 'random' ? all.slice() : all.slice(s)
  }

  if (order === 'random') {
    list = shuffle(list)
  } else if (order === 'pri') {
    list.sort((a, b) => {
      const d = priKey(words[a]) - priKey(words[b])
      if (d) return d
      const f = freqKey(words[a]) - freqKey(words[b])
      return f ? f : a - b
    })
  } else if (order === 'freq' || order === 'rare') {
    const dir = order === 'rare' ? -1 : 1
    list.sort((a, b) => {
      const d = freqKey(words[a]) - freqKey(words[b])
      return (d ? d : a - b) * dir
    })
  }
  return list
}

export interface Counts {
  ok: number
  no: number
  done: number
  total: number
}

export function countsOf(words: Word[], ans: Record<number, Mark>): Counts {
  let ok = 0
  let no = 0
  for (const k in ans) {
    if (ans[k] === 1) ok++
    else no++
  }
  return { ok, no, done: ok + no, total: words.length }
}

/** 跳转到下一个「不会」或「未标记」的词，返回新位置；找不到返回 -1 */
export function nextWeakPos(
  idx: number[],
  ans: Record<number, Mark>,
  from: number,
): number {
  for (let p = from + 1; p < idx.length; p++) {
    if (ans[idx[p]] !== 1) return p
  }
  for (let p = 0; p < idx.length; p++) {
    if (p === from) continue
    if (ans[idx[p]] !== 1) return p
  }
  return -1
}

/** 星级显示：返回 [实心数, 空心数] */
export function stars(c: number): [number, number] {
  const n = Math.max(0, Math.min(5, c))
  return [n, 5 - n]
}

export function freqTitle(w: Word): string {
  const parts: string[] = []
  if (w.f) parts.push('词频排名 ' + w.f + '/5 万词表')
  if (w.c) parts.push('柯林斯 ' + w.c + ' 星')
  if (w.a) parts.push('认知率 ' + w.a + '%')
  return parts.join(' · ')
}
