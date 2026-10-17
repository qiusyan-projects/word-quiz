import type { Persisted, Word } from './types'

const LS_KEY = 'wordquiz.react.v1'
const LS_WORDS = 'wordquiz.react.custom'

export function loadPersisted(): Partial<Persisted> | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : null
  } catch {
    return null
  }
}

export function savePersisted(p: Persisted) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {
    /* 隐私模式 / 配额满：忽略，不影响使用 */
  }
}

export function clearPersisted() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

export function loadCustomWords(): Word[] | null {
  try {
    const raw = localStorage.getItem(LS_WORDS)
    if (!raw) return null
    const d = JSON.parse(raw)
    return Array.isArray(d) && d.length ? (d as Word[]) : null
  } catch {
    return null
  }
}

export function saveCustomWords(w: Word[] | null) {
  try {
    if (w) localStorage.setItem(LS_WORDS, JSON.stringify(w))
    else localStorage.removeItem(LS_WORDS)
  } catch {
    /* ignore */
  }
}
