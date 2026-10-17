export interface Word {
  /** 词条 */
  w: string
  /** 音标 */
  p: string
  /** 释义 */
  m: string
  /** 层级 */
  lv: string
  /** 来源 */
  src: string
  /** 高中类词书命中数 */
  h: number
  /** 是否在星火高考词书 */
  xh: number
  /** 来源层级 1课标 2星火 3共识 4CET4 5CET6 */
  tier: number
  /** 初中词书命中本数 */
  jr: number
  /** 1 = 初中段基础词 */
  bs: number
  /** 语料库词频排名，1 = 最常用 */
  f: number
  /** 常用度星级 1-5 */
  c: number
  /** 认知率百分比 */
  a: number
  /** 优先级 0基础 1课标 2星火 3共识 4CET4 5CET6 */
  pri: number
  /** 1 = 高考核心 */
  core: number
  /** 高考真题高频：2 = 核心高频688，1 = 核心扩展110，0/缺省 = 不在该书 */
  gk?: number
}

export type View = 'home' | 'card' | 'result'

export type RangeId =
  | 'all' | 'gk688' | 'core' | 'cs' | 'junior' | 'senior' | 'bridge'
export type OrderId = 'asc' | 'random' | 'pri' | 'freq' | 'rare'

/** 1 = 会，0 = 不会 */
export type Mark = 0 | 1

export interface Persisted {
  ans: Record<number, Mark>
  pos: number
  idx: number[]
  range: RangeId
  order: OrderId
  start: number
  showPh: boolean
  showMean: boolean
  speak: boolean
}
