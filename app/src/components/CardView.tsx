import * as React from 'react'
import { Check, Eye, EyeOff, SkipForward, Volume2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { freqTitle, stars } from '@/lib/quiz'
import type { Counts } from '@/lib/quiz'
import type { Mark, Word } from '@/lib/types'

interface Props {
  word?: Word
  /** 当前词在词库中的下标，用于回显「上次标记」 */
  wi?: number
  pos: number
  total: number
  counts: Counts
  reveal: boolean
  showPh: boolean
  ans: Record<number, Mark>
  onOk: () => void
  onNo: () => void
  onMean: () => void
  onSpeak: (t: string) => void
  onUndo: () => void
  onPrev: () => void
  onSkip: () => void
  onJumpWeak: () => void
  onFinish: () => void
}

function Stars({ c }: { c: number }) {
  const [on, off] = stars(c)
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {Array.from({ length: on }).map((_, i) => (
        <span key={'on' + i} className="text-foreground">★</span>
      ))}
      {Array.from({ length: off }).map((_, i) => (
        <span key={'off' + i} className="text-muted-foreground/35">★</span>
      ))}
    </span>
  )
}

export default function CardView(p: Props) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [anim, setAnim] = React.useState<'' | 'swipe-r' | 'swipe-l'>('')

  // 手势回调保持最新，避免重复绑定监听
  const cb = React.useRef(p)
  cb.current = p

  React.useEffect(() => {
    const el = stageRef.current
    if (!el) return
    let sx = 0, sy = 0
    let tracking = false
    let swiped = false
    let busy = false
    const TH = 46

    const onClick = () => {
      if (busy) return
      if (swiped) { swiped = false; return }
      cb.current.onMean()
    }
    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      tracking = true
      swiped = false
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      // 横向意图明确时阻止纵向滚动，否则滑到一半页面会跟着滚
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) && e.cancelable) {
        e.preventDefault()
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      // 位移不够或纵向分量过大 → 当成点按，交给 click
      if (Math.abs(dx) < TH || Math.abs(dx) < Math.abs(dy) * 1.4) return
      swiped = true
      busy = true
      setAnim(dx > 0 ? 'swipe-r' : 'swipe-l')
      window.setTimeout(() => {
        setAnim('')
        if (dx > 0) cb.current.onOk()
        else cb.current.onNo()
        busy = false
      }, 160)
    }

    el.addEventListener('click', onClick)
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  const w = p.word
  if (!w) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        没有可显示的单词
        <div className="mt-4">
          <Button variant="outline" onClick={p.onFinish}>查看结果</Button>
        </div>
      </div>
    )
  }

  const lvDup = (w.bs && w.lv === '课标·基础') || (!!w.gk && w.lv === '高考真题高频')
  const prevMark = p.wi !== undefined ? p.ans[p.wi] : undefined
  const pct = p.total ? (p.pos / p.total) * 100 : 0

  return (
    <div className="space-y-4">
      {/* 统计条 */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <b className="tnum">{`${p.pos + 1} / ${p.total}`}</b>
        <span className="text-muted-foreground">·</span>
        <span className="tnum">会 <b>{p.counts.ok}</b></span>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={p.onJumpWeak}
          title="跳到记不清的词"
          className="tnum focus-ring rounded-md underline-offset-4 hover:underline"
        >
          不会 <b>{p.counts.no}</b>
        </button>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={p.onFinish}>
          结果 <kbd className="ml-1">Esc</kbd>
        </Button>
      </div>

      <Progress value={pct} />

      {/* 单词卡片：点按看释义、左右滑动标记 */}
      <div
        ref={stageRef}
        className={cn(
          'flex min-h-[min(52vh,400px)] cursor-pointer touch-pan-y flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-12 text-center select-none',
          'transition-transform active:scale-[0.994]',
          'animate-rise',
          anim,
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          {prevMark === 1 && (
            <Badge variant="outline" className="tnum">上次标记：会 ✓</Badge>
          )}
          {prevMark === 0 && (
            <Badge variant="outline" className="tnum">上次标记：不会 ✗</Badge>
          )}
          {w.gk ? (
            <Badge
              variant="default"
              className="border-foreground/25"
              title={w.gk === 2
                ? '收录于《高考历年真题核心高频 688》（真题语料统计）'
                : '《高考历年真题核心高频 688》的核心扩展词'}
            >
              <span aria-hidden="true">★</span>
              真题高频{w.gk === 1 ? ' · 扩展' : ''}
            </Badge>
          ) : null}
          {w.bs === 1 && (
            <Badge variant="solid" title={'初中段基础词' + (w.jr > 0 ? `（${w.jr} 本初中教材/词书收录）` : '（教育部课标义务教育段要求）')}>
              初中基础
            </Badge>
          )}
          {w.lv && !lvDup && (
            <Badge variant="muted" title={w.lv}>
              {w.lv + (w.xh ? ' · 星火' : '')}
            </Badge>
          )}
        </div>

        <div
          className="font-semibold tracking-tight break-words"
          style={{ fontSize: 'clamp(38px, 8vw, 72px)', lineHeight: 1.1 }}
          role="status"
          aria-live="polite"
        >
          {w.w}
        </div>

        {p.showPh && w.p && (
          <div className="text-base text-muted-foreground">{w.p}</div>
        )}

        {w.c > 0 && (
          <div className="flex items-center gap-2 text-sm" title={freqTitle(w)}>
            <Stars c={w.c} />
            <span className="sr-only">
              常用度 {w.c}/5{w.f ? `，词频排名 ${w.f}` : ''}{w.a ? `，认知率 ${w.a}%` : ''}
            </span>
            {w.a > 0 && <span className="tnum text-xs text-muted-foreground">认知率 {w.a}%</span>}
          </div>
        )}

        {p.reveal && w.m && (
          <div className="animate-rise max-w-2xl text-lg text-foreground/90">{w.m}</div>
        )}

        {!p.reveal && (
          <div className="text-xs text-muted-foreground">
            按 <kbd>S</kbd> 或点卡片查看释义
          </div>
        )}
      </div>

      {/* 主操作 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button variant="outline" size="xl" onClick={p.onNo}>
          <X className="size-5" />
          不认识
          <kbd className="ml-1">N</kbd>
        </Button>
        <Button
          variant="ghost"
          size="xl"
          onClick={() => p.onSpeak(w.w)}
          aria-label="朗读当前单词"
        >
          <Volume2 className="size-5" />
          朗读
          <kbd className="ml-1">P</kbd>
        </Button>
        <Button variant="default" size="xl" onClick={p.onOk}>
          <Check className="size-5" />
          认识
          <kbd className="ml-1">空格</kbd>
        </Button>
      </div>

      {/* 副操作 */}
      <div className="flex flex-wrap justify-center gap-1.5">
        <Button variant="outline" size="sm" onClick={p.onMean}>
          {p.reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          释义 <kbd className="ml-1">S</kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={p.onUndo}>
          撤销 <kbd className="ml-1">U</kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={p.onPrev}>
          上一个 <kbd className="ml-1">↑</kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={p.onSkip}>
          <SkipForward className="size-4" />
          跳过 <kbd className="ml-1">X</kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={p.onJumpWeak}>
          下一个生词 <kbd className="ml-1">W</kbd>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        触摸屏：<b className="text-foreground">点卡片</b>看释义 ·
        <b className="text-foreground"> 右滑</b>认识 ·
        <b className="text-foreground"> 左滑</b>不认识
      </p>
    </div>
  )
}
