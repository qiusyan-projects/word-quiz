import * as React from 'react'
import { createPortal } from 'react-dom'

import defaultWords from '@/data/words.json'
import { useToast } from '@/components/ui/toast'
import HomeView from '@/components/HomeView'
import CardView from '@/components/CardView'
import ResultView from '@/components/ResultView'
import {
  buildList,
  countsOf,
  nextWeakPos,
} from '@/lib/quiz'
import {
  clearPersisted,
  loadCustomWords,
  loadPersisted,
  saveCustomWords,
  savePersisted,
} from '@/lib/store'
import type { Mark, OrderId, RangeId, View, Word } from '@/lib/types'

const DEFAULT_WORDS = defaultWords as Word[]

export default function App() {
  const toast = useToast()

  // 只读一次本地存档，作为各状态的初始值
  const saved = React.useMemo(() => loadPersisted(), [])

  const [words, setWords] = React.useState<Word[]>(
    () => loadCustomWords() ?? DEFAULT_WORDS,
  )
  const [view, setView] = React.useState<View>('home')
  const [range, setRange] = React.useState<RangeId>(saved?.range ?? 'all')
  const [order, setOrder] = React.useState<OrderId>(saved?.order ?? 'asc')
  const [start, setStart] = React.useState<number>(saved?.start ?? 1)
  const [showPh, setShowPh] = React.useState<boolean>(saved?.showPh ?? true)
  const [showMean, setShowMean] = React.useState<boolean>(saved?.showMean ?? false)
  const [speak, setSpeak] = React.useState<boolean>(saved?.speak ?? false)

  const [idx, setIdx] = React.useState<number[]>(saved?.idx ?? [])
  const [pos, setPos] = React.useState<number>(saved?.pos ?? 0)
  const [ans, setAns] = React.useState<Record<number, Mark>>(saved?.ans ?? {})
  const [reveal, setReveal] = React.useState(false)

  const counts = React.useMemo(() => countsOf(words, ans), [words, ans])

  // ---------- 持久化 ----------
  React.useEffect(() => {
    savePersisted({ ans, pos, idx, range, order, start, showPh, showMean, speak })
  }, [ans, pos, idx, range, order, start, showPh, showMean, speak])

  const speakWord = React.useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.rate = 0.9
      window.speechSynthesis.speak(u)
    } catch {
      /* 忽略：部分浏览器无语音合成 */
    }
  }, [])

  const curWord: Word | undefined = words[idx[pos]]

  // ---------- 答题操作 ----------
  const answer = React.useCallback(
    (ok: boolean) => {
      if (!idx.length) return
      const wi = idx[pos]
      if (wi === undefined) return
      setAns((prev) => ({ ...prev, [wi]: (ok ? 1 : 0) as Mark }))
      if (speak) speakWord(words[wi].w)
      if (pos + 1 >= idx.length) {
        setView('result')
      } else {
        setPos(pos + 1)
      }
    },
    [idx, pos, speak, speakWord, words],
  )

  const undo = React.useCallback(() => {
    if (pos === 0) {
      toast('已经在第一个了')
      return
    }
    const p = pos - 1
    const wi = idx[p]
    setAns((prev) => {
      const next = { ...prev }
      delete next[wi]
      return next
    })
    setPos(p)
  }, [idx, pos, toast])

  const prevWord = React.useCallback(() => {
    if (pos === 0) {
      toast('已经在第一个了')
      return
    }
    setPos(pos - 1)
  }, [pos, toast])

  const skipWord = React.useCallback(() => {
    if (pos + 1 >= idx.length) {
      setView('result')
      return
    }
    setPos(pos + 1)
  }, [idx.length, pos])

  const jumpWeak = React.useCallback(() => {
    const p = nextWeakPos(idx, ans, pos)
    if (p < 0) {
      toast('没有待巩固的词了')
      return
    }
    setPos(p)
  }, [ans, idx, pos, toast])

  const toggleMean = React.useCallback(() => setReveal((r) => !r), [])

  // 换词时按「直接显示释义」选项重置
  React.useEffect(() => {
    setReveal(showMean)
  }, [showMean, pos, view])

  // ---------- 开启新一轮 ----------
  const startRound = React.useCallback(
    (mode: 'normal' | 'weak') => {
      const list = buildList(words, range, order, start, mode, ans)
      if (!list.length) {
        toast(mode === 'weak' ? '没有标记为「不会」的单词' : '当前范围没有词')
        return false
      }
      setIdx(list)
      setPos(0)
      setView('card')
      return true
    },
    [words, range, order, start, ans, toast],
  )

  const resetAll = React.useCallback(() => {
    if (!window.confirm('确认清空所有标记和进度？词库不受影响。')) return
    setAns({})
    setPos(0)
    setIdx([])
    clearPersisted()
    setView('home')
    toast('已重置')
  }, [toast])

  const applyCustomWords = React.useCallback(
    (list: Word[] | null) => {
      if (list) {
        setWords(list)
        saveCustomWords(list)
      } else {
        setWords(DEFAULT_WORDS)
        saveCustomWords(null)
      }
      setAns({})
      setIdx([])
      setPos(0)
      setView('home')
    },
    [],
  )

  // ---------- 键盘 ----------
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (t?.isContentEditable) return

      if (e.key === 'Escape') {
        if (view === 'card') setView('result')
        else if (view === 'result') setView('card')
        return
      }

      const k = (e.key || '').toLowerCase()

      if (view === 'result') {
        if (e.key === '/') {
          e.preventDefault()
          document.getElementById('filterText')?.focus()
        } else if (k === 'b') {
          e.preventDefault()
          if (!idx.length) startRound('normal')
          else setView('card')
        } else if (k === 'r') {
          e.preventDefault()
          startRound('weak')
        } else if (k === 'h') {
          e.preventDefault()
          setView('home')
        }
        return
      }

      if (view === 'home') {
        if (e.key === 'Enter') {
          e.preventDefault()
          startRound('normal')
        }
        return
      }

      if (view !== 'card') return

      if (
        e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter' ||
        k === 'y' || k === '1'
      ) {
        e.preventDefault()
        answer(true)
      } else if (e.key === 'ArrowLeft' || k === 'n' || k === '2') {
        e.preventDefault()
        answer(false)
      } else if (k === 's' || e.key === 'ArrowDown') {
        e.preventDefault()
        toggleMean()
      } else if (k === 'p') {
        e.preventDefault()
        if (curWord) speakWord(curWord.w)
      } else if (k === 'u' || e.key === 'Backspace') {
        e.preventDefault()
        undo()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        prevWord()
      } else if (k === 'x') {
        e.preventDefault()
        skipWord()
      } else if (k === 'w') {
        e.preventDefault()
        jumpWeak()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [
    view, curWord, answer, undo, prevWord, skipWord, jumpWeak,
    toggleMean, startRound, speakWord, idx.length,
  ])

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-20 sm:px-6">
      {view === 'home' && (
        <HomeView
          words={words}
          counts={counts}
          range={range}
          order={order}
          start={start}
          showPh={showPh}
          showMean={showMean}
          speak={speak}
          hasProgress={!!idx.length || counts.done > 0}
          onRange={setRange}
          onOrder={setOrder}
          onStart={setStart}
          onShowPh={setShowPh}
          onShowMean={setShowMean}
          onSpeak={setSpeak}
          onNew={() => startRound('normal')}
          onResume={() => {
            if (idx.length) setView('card')
            else toast('没有可继续的进度')
          }}
          onWeak={() => startRound('weak')}
          onResetAll={resetAll}
          onImport={(list) => {
            applyCustomWords(list)
            toast('已导入 ' + list.length + ' 条')
          }}
          onRestore={() => {
            applyCustomWords(null)
            toast('已恢复默认词库 ' + DEFAULT_WORDS.length + ' 条')
          }}
        />
      )}

      {view === 'card' && (
        <CardView
          word={curWord}
          wi={idx[pos]}
          pos={pos}
          total={idx.length}
          counts={counts}
          reveal={reveal}
          showPh={showPh}
          ans={ans}
          onOk={() => answer(true)}
          onNo={() => answer(false)}
          onMean={toggleMean}
          onSpeak={speakWord}
          onUndo={undo}
          onPrev={prevWord}
          onSkip={skipWord}
          onJumpWeak={jumpWeak}
          onFinish={() => setView('result')}
        />
      )}

      {view === 'result' && (
        <ResultView
          words={words}
          ans={ans}
          idx={idx}
          counts={counts}
          onBack={() => {
            if (!idx.length) startRound('normal')
            else setView('card')
          }}
          onRetestWeak={() => startRound('weak')}
          onHome={() => setView('home')}
          toast={toast}
        />
      )}

      {/* 打印容器挂在 body 下：打印 CSS 依赖「body 直接子级」这一结构 */}
      {createPortal(<div id="printArea" aria-hidden="true" />, document.body)}
    </div>
  )
}