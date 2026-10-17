import * as React from 'react'
import { Play, RotateCcw, Upload, FileText, History } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { parseImport } from '@/lib/exports'
import type { Counts } from '@/lib/quiz'
import type { OrderId, RangeId, Word } from '@/lib/types'

interface Props {
  words: Word[]
  counts: Counts
  range: RangeId
  order: OrderId
  start: number
  showPh: boolean
  showMean: boolean
  speak: boolean
  hasProgress: boolean
  onRange: (v: RangeId) => void
  onOrder: (v: OrderId) => void
  onStart: (v: number) => void
  onShowPh: (v: boolean) => void
  onShowMean: (v: boolean) => void
  onSpeak: (v: boolean) => void
  onNew: () => void
  onResume: () => void
  onWeak: () => void
  onResetAll: () => void
  onImport: (list: Word[]) => void
  onRestore: () => void
}

const KEYS: Array<{ keys: string[]; desc: string }> = [
  { keys: ['空格', '→', 'Enter'], desc: '认识，下一个' },
  { keys: ['N', '←'], desc: '不认识，下一个' },
  { keys: ['S', '↓'], desc: '显示 / 隐藏释义' },
  { keys: ['P'], desc: '朗读发音' },
  { keys: ['↑'], desc: '上一个词（不改变标记）' },
  { keys: ['X'], desc: '跳过，不标记' },
  { keys: ['W'], desc: '跳到下一个不会 / 未标记的词' },
  { keys: ['U', 'Backspace'], desc: '撤销上一个标记' },
  { keys: ['Esc'], desc: '查看结果 / 返回答题' },
  { keys: ['/'], desc: '结果页聚焦搜索框' },
  { keys: ['B', 'R', 'H'], desc: '结果页：继续 / 重测不会 / 返回首页' },
]

const ORDER_LABEL: Record<OrderId, string> = {
  asc: '正序 A → Z',
  random: '随机乱序',
  pri: '按优先级（基础 → 高中 → 衔接）',
  freq: '高频优先（常用词先测）',
  rare: '低频优先（生僻词先测）',
}

export default function HomeView(p: Props) {
  const [importText, setImportText] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)

  const n = React.useMemo(() => {
    let core = 0, cs = 0, junior = 0, bridge = 0, gk = 0
    for (const w of p.words) {
      const lv = w.lv || ''
      if (w.core === 1) core++
      if (w.gk) gk++
      if (lv.indexOf('课标') >= 0) cs++
      if (lv.indexOf('CET') >= 0) bridge++
      if (w.bs) junior++
    }
    return { all: p.words.length, core, cs, junior, senior: p.words.length - junior, bridge, gk }
  }, [p.words])

  // 顺序即下拉顺序：真题高频放最前，它是这批词里最硬的筛选条件
  const rangeLabel: Record<RangeId, string> = {
    all: `全部 · ${n.all} 条`,
    gk688: `高考真题高频 688 · ${n.gk} 条`,
    core: `高考核心 · ${n.core} 条`,
    cs: `仅教育部课标 · ${n.cs} 条`,
    junior: `仅初中基础词汇 · ${n.junior} 条`,
    senior: `高中及以上（跳过基础）· ${n.senior} 条`,
    bridge: `仅四六级衔接 · ${n.bridge} 条`,
  }

  const readFile = (f: File) => {
    const fr = new FileReader()
    fr.onload = () => {
      const list = parseImport(String(fr.result || ''))
      if (!list.length) return
      p.onImport(list)
    }
    fr.readAsText(f, 'utf-8')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h4l5 12 5-8h2" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg leading-tight font-semibold">单词自测</h1>
            <p className="tnum text-xs text-muted-foreground">
              高考英语词汇 {p.words.length} 条 · 键盘 / 触摸双操作
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {p.counts.done > 0 && (
            <Badge variant="outline" className="tnum">
              {`已测 ${p.counts.done} / ${p.words.length}`}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={p.onResetAll}>
            <RotateCcw className="size-4" />
            重置
          </Button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <Card>
          <CardHeader>
            <CardTitle>开始测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: '已标记', v: p.counts.done },
                { label: '会', v: p.counts.ok },
                { label: '不会', v: p.counts.no },
                { label: '未测试', v: Math.max(0, p.words.length - p.counts.done) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border px-3 py-2.5">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="tnum text-xl font-semibold">{s.v}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>测试范围</Label>
                <Select value={p.range} onValueChange={(v) => p.onRange(v as RangeId)}>
                  <SelectTrigger>
                    {/* 必须显式给文本：Radix 未展开过 Content 时取不到选中项 */}
                    <SelectValue>{rangeLabel[p.range]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(rangeLabel) as RangeId[]).map((k) => (
                      <SelectItem key={k} value={k}>{rangeLabel[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>顺序</Label>
                <Select value={p.order} onValueChange={(v) => p.onOrder(v as OrderId)}>
                  <SelectTrigger>
                    <SelectValue>{ORDER_LABEL[p.order]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORDER_LABEL) as OrderId[]).map((k) => (
                      <SelectItem key={k} value={k}>{ORDER_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="startPos">起始位置</Label>
                <Input
                  id="startPos"
                  type="number"
                  min={1}
                  value={p.start}
                  onChange={(e) => p.onStart(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>

              <div className="space-y-2.5 pt-1">
                {([
                  ['显示音标', p.showPh, p.onShowPh],
                  ['直接显示释义', p.showMean, p.onShowMean],
                  ['标记后自动朗读', p.speak, p.onSpeak],
                ] as const).map(([label, val, set]) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox checked={val} onCheckedChange={(v) => set(!!v)} />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button onClick={p.onNew}>
                <Play className="size-4" />
                开始新一轮
              </Button>
              <Button variant="outline" onClick={p.onResume} disabled={!p.hasProgress}>
                <History className="size-4" />
                继续上次
              </Button>
              <Button variant="outline" onClick={p.onWeak} disabled={!p.counts.no}>
                只测「不会」的
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              进度保存在本机浏览器（localStorage），不跨设备同步。
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>快捷键</CardTitle>
              <span className="text-xs text-muted-foreground">纯键盘操作</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {KEYS.map((k) => (
                <div key={k.desc} className="flex items-center gap-2.5 text-sm">
                  <span className="flex shrink-0 gap-1">
                    {k.keys.map((x) => <kbd key={x}>{x}</kbd>)}
                  </span>
                  <span className="text-muted-foreground">{k.desc}</span>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                触摸屏：点卡片看释义，右滑标记认识，左滑标记不认识。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导入自定义词表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                每行一条：<code>word</code>、<code>word Tab 释义</code> 或 <code>word,释义</code>
              </p>
              <Textarea
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'abandon\tv. 放弃\nability\tn. 能力'}
              />
              <div className="flex flex-wrap gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => {
                    const list = parseImport(importText)
                    if (!list.length) return
                    p.onImport(list)
                  }}
                >
                  <Upload className="size-4" />
                  导入替换
                </Button>
                <Button variant="ghost" onClick={p.onRestore}>恢复默认</Button>
                <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                  <FileText className="size-4" />
                  选择文件
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) readFile(f)
                    e.target.value = ''
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
