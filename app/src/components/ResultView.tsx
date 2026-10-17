import * as React from 'react'
import {
  Copy, FileDown, FileText, FileSpreadsheet, ArrowLeft, RotateCcw, Home,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  buildDoc, exportCsv, exportPdf, exportTxt, rowsFor,
} from '@/lib/exports'
import { freqTitle, stars } from '@/lib/quiz'
import { cn } from '@/lib/utils'
import type { Counts } from '@/lib/quiz'
import type { Mark, Word } from '@/lib/types'

interface Props {
  words: Word[]
  ans: Record<number, Mark>
  idx: number[]
  counts: Counts
  onBack: () => void
  onRetestWeak: () => void
  onHome: () => void
  toast: (m: string) => void
}

const MAX_ROWS = 400

function RateRing({ rate }: { rate: number }) {
  const C = 2 * Math.PI * 52
  return (
    <div className="relative size-[148px] shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor"
          className="text-secondary" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="52" fill="none" stroke="currentColor"
          className="text-foreground transition-[stroke-dashoffset] duration-700 ease-out"
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - rate / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="tnum text-3xl font-semibold">{`${rate}%`}</b>
        <span className="text-xs text-muted-foreground">掌握率</span>
      </div>
    </div>
  )
}

function verdictText(rate: number, c: Counts) {
  if (!c.done) return '还没开始测试，先过一轮看看真实水平。'
  const left = c.no
  if (rate >= 90) return `掌握得很稳，剩下的 ${left} 个是硬骨头，集中攻克就行。`
  if (rate >= 70) return `底子不错，优先把 ${left} 个生词刷熟。`
  if (rate >= 45) return '一半上下，建议用「重测不会的词」再连过两轮。'
  return `别慌，先把最短、最常见的那批拿下，再回头扫 ${left} 个生词。`
}

function freqVerdict(words: Word[], ans: Record<number, Mark>) {
  const weak: Word[] = []
  for (let i = 0; i < words.length; i++) if (ans[i] === 0) weak.push(words[i])
  if (!weak.length) return ''
  const high = weak.filter((w) => w.c >= 4)
  if (!high.length) return '好消息：高频词（4-5 星）你全都会了，剩下的都是低频词。'
  const pct = Math.round((high.length / weak.length) * 100)
  const top = high
    .slice()
    .sort((a, b) => (a.f || 99999) - (b.f || 99999))
    .slice(0, 5)
    .map((w) => w.w)
  return `不会的词里 ${high.length} 个是高频词（4-5 星，占 ${pct}%），最该先拿下：${top.join('、')}。`
}

function baseVerdict(words: Word[], ans: Record<number, Mark>) {
  const weak: Word[] = []
  for (let i = 0; i < words.length; i++) if (ans[i] === 0) weak.push(words[i])
  if (!weak.length) return ''
  const bs = weak.filter((w) => w.bs)
  if (!bs.length) return '生词全部集中在高中及以上，初中基础段没有缺口。'
  const pct = Math.round((bs.length / weak.length) * 100)
  return `生词里 ${bs.length} 个属于初中基础词（占 ${pct}%）` +
    (pct >= 30 ? '，基础段有缺口，建议先用「仅初中基础词汇」过一轮。' : '，基础段基本扎实。')
}

const LEVEL_LABEL: Record<string, string> = {
  '': '全部层级',
  __gk: '高考真题高频',
  __base: '初中基础词汇',
  __senior: '高中及以上（非基础）',
  课标: '课标（教育部）',
  高考词书: '高考词书（星火）',
  高考真题高频: '真题高频（补录派生形）',
  教材: '教材/词书共识',
  CET4: 'CET4 衔接',
  CET6: 'CET6 衔接',
}
const STATUS_LABEL: Record<string, string> = {
  no: '不会', ok: '会', skip: '未标记', all: '全部词库',
}
const FREQ_LABEL: Record<string, string> = {
  '': '全部常用度',
  high: '高频（4-5 星）',
  mid: '中频（3 星）',
  low: '低频（1-2 星）',
  none: '未评级',
}

const statusTag = (s: string) =>
  s === 'ok' ? '会' : s === 'no' ? '不会' : '未标记'

export default function ResultView(p: Props) {
  const [fLevel, setFLevel] = React.useState('')
  const [fStatus, setFStatus] = React.useState('no')
  const [fFreq, setFFreq] = React.useState('')
  const [q, setQ] = React.useState('')

  const rate = p.counts.done ? Math.round((p.counts.ok / p.counts.done) * 100) : 0

  const rows = React.useMemo(() => {
    const base = fStatus === 'all' || !p.idx.length
      ? p.words.map((_, i) => i)
      : p.idx
    const needle = q.trim().toLowerCase()
    const out: Array<{ i: number; w: Word; st: string }> = []
    for (const i of base) {
      const w = p.words[i]
      if (!w) continue
      const a = p.ans[i]
      const st = a === 1 ? 'ok' : a === 0 ? 'no' : 'none'
      if (fStatus === 'no' && st !== 'no') continue
      if (fStatus === 'ok' && st !== 'ok') continue
      if (fStatus === 'skip' && st !== 'none') continue
      if (fLevel === '__gk' && !w.gk) continue
      if (fLevel === '__base' && !w.bs) continue
      if (fLevel === '__senior' && w.bs) continue
      if (fLevel && fLevel.indexOf('__') !== 0 && (w.lv || '').indexOf(fLevel) < 0) continue
      if (fFreq === 'high' && w.c < 4) continue
      if (fFreq === 'mid' && w.c !== 3) continue
      if (fFreq === 'low' && (w.c < 1 || w.c > 2)) continue
      if (fFreq === 'none' && w.c > 0) continue
      if (needle && w.w.toLowerCase().indexOf(needle) < 0 &&
          (w.m || '').toLowerCase().indexOf(needle) < 0) continue
      out.push({ i, w, st })
      if (out.length >= MAX_ROWS) break
    }
    return out
  }, [p.words, p.ans, p.idx, fLevel, fStatus, fFreq, q])

  const weakRows = React.useMemo(() => rowsFor(p.words, p.ans, true), [p.words, p.ans])

  const doPdf = (quiz: boolean) => {
    if (!weakRows.length) { p.toast('还没有标记为「不会」的单词'); return }
    const html = buildDoc(weakRows, quiz, rate, p.counts.done)
    exportPdf(html, weakRows.length, p.toast)
  }

  const doCsv = (onlyWeak: boolean) => {
    const r = rowsFor(p.words, p.ans, onlyWeak)
    if (!r.length) { p.toast('没有可导出的内容'); return }
    exportCsv(r, onlyWeak)
    p.toast('已导出 CSV，共 ' + r.length + ' 条')
  }

  const doTxt = () => {
    if (!weakRows.length) { p.toast('还没有标记为「不会」的单词'); return }
    exportTxt(weakRows)
    p.toast('已导出 TXT，共 ' + weakRows.length + ' 条')
  }

  const doCopy = async () => {
    if (!weakRows.length) { p.toast('还没有标记为「不会」的单词'); return }
    const text = weakRows.map((r) => r.word).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      p.toast('已复制 ' + weakRows.length + ' 个生词到剪贴板')
    } catch {
      p.toast('复制失败，请改用导出')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>掌握情况</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <RateRing rate={rate} />
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { l: '词库总数', v: p.counts.total },
                { l: '已测试', v: p.counts.done },
                { l: '会', v: p.counts.ok },
                { l: '不会', v: p.counts.no },
                { l: '未测试', v: p.counts.total - p.counts.done },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-xs text-muted-foreground">{s.l}</div>
                  <div className="tnum text-lg font-semibold">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm">
              <p>{verdictText(rate, p.counts)}</p>
              {freqVerdict(p.words, p.ans) && (
                <p className="text-muted-foreground">{freqVerdict(p.words, p.ans)}</p>
              )}
              {baseVerdict(p.words, p.ans) && (
                <p className="text-muted-foreground">{baseVerdict(p.words, p.ans)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>导出</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => doPdf(false)}>
              <FileDown className="size-4" />
              导出生词 PDF（含音标释义）
            </Button>
            <Button variant="outline" onClick={() => doPdf(true)}>
              <FileDown className="size-4" />
              默写版 PDF
            </Button>
            <Button variant="outline" onClick={() => doCsv(true)}>
              <FileSpreadsheet className="size-4" />
              生词 CSV
            </Button>
            <Button variant="outline" onClick={doTxt}>
              <FileText className="size-4" />
              生词 TXT
            </Button>
            <Button variant="ghost" onClick={() => doCsv(false)}>全部结果 CSV</Button>
            <Button variant="ghost" onClick={doCopy}>
              <Copy className="size-4" />
              复制生词
            </Button>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={p.onBack}>
              <ArrowLeft className="size-4" />
              继续测试 <kbd className="ml-1">Esc</kbd>
            </Button>
            <Button variant="outline" onClick={p.onRetestWeak} disabled={!p.counts.no}>
              <RotateCcw className="size-4" />
              重测「不会」的词 <kbd className="ml-1">R</kbd>
            </Button>
            <Button variant="ghost" onClick={p.onHome}>
              <Home className="size-4" />
              返回首页 <kbd className="ml-1">H</kbd>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>单词清单</CardTitle>
            <span className="tnum text-xs text-muted-foreground">
              共 {rows.length} 条{rows.length >= MAX_ROWS ? `（已截断，请用筛选缩小范围）` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={fLevel || 'all'} onValueChange={(v) => setFLevel(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[168px]">
                <SelectValue>{LEVEL_LABEL[fLevel] ?? '全部层级'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部层级</SelectItem>
                <SelectItem value="__gk">高考真题高频</SelectItem>
                <SelectItem value="__base">初中基础词汇</SelectItem>
                <SelectItem value="__senior">高中及以上（非基础）</SelectItem>
                <SelectItem value="课标">课标（教育部）</SelectItem>
                <SelectItem value="高考词书">高考词书（星火）</SelectItem>
                <SelectItem value="高考真题高频">真题高频（补录派生形）</SelectItem>
                <SelectItem value="教材">教材/词书共识</SelectItem>
                <SelectItem value="CET4">CET4 衔接</SelectItem>
                <SelectItem value="CET6">CET6 衔接</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[132px]">
                <SelectValue>{STATUS_LABEL[fStatus] ?? '不会'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">不会</SelectItem>
                <SelectItem value="ok">会</SelectItem>
                <SelectItem value="skip">未标记</SelectItem>
                <SelectItem value="all">全部词库</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fFreq || 'all'} onValueChange={(v) => setFFreq(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[148px]">
                <SelectValue>{FREQ_LABEL[fFreq] ?? '全部常用度'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部常用度</SelectItem>
                <SelectItem value="high">高频（4-5 星）</SelectItem>
                <SelectItem value="mid">中频（3 星）</SelectItem>
                <SelectItem value="low">低频（1-2 星）</SelectItem>
                <SelectItem value="none">未评级</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="filterText"
              type="search"
              placeholder="搜索单词或释义（按 / 聚焦）"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-[240px]"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {rows.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">没有匹配的条目</div>
          )}
          {rows.map(({ i, w, st }) => {
            const [on, off] = stars(w.c)
            return (
              <div
                key={i}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-sm odd:bg-secondary/30"
              >
                <span className="min-w-[110px] font-medium">
                  {w.gk ? (
                    <span
                      className={cn('mr-1 align-top text-[11px]', w.gk === 1 && 'text-muted-foreground')}
                      title={w.gk === 2 ? '高考真题核心高频688' : '真题高频·核心扩展'}
                    >
                      ★
                    </span>
                  ) : null}
                  {w.w}
                </span>
                <span className="flex gap-0.5 text-xs" title={w.c ? freqTitle(w) : ''}>
                  <span className="sr-only">常用度 {w.c}/5</span>
                  {Array.from({ length: on }).map((_, k) => <span key={k}>★</span>)}
                  {Array.from({ length: off }).map((_, k) => (
                    <span key={'o' + k} className="text-muted-foreground/30">★</span>
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">{w.p}</span>
                <span className="flex-1 text-foreground/85">{w.m}</span>
                {w.bs === 1
                  ? <Badge variant="solid" className="text-[11px]">初中基础</Badge>
                  : w.lv
                    ? <Badge variant="outline" className="text-[11px]">{w.lv}</Badge>
                    : null}
                <Badge
                  variant={st === 'ok' ? 'solid' : st === 'no' ? 'default' : 'muted'}
                  className="text-[11px]"
                >
                  {statusTag(st)}
                </Badge>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
