/**
 * 组件渲染冒烟测试（不参与生产构建）
 * 用 react-dom/server 把三个视图真实渲染成 HTML，断言关键结构存在。
 * 目的：确认 React 组件树能正常渲染、关键交互文案与元素都在，
 * 而不是只验证「HTTP 200」。
 */
import * as React from 'react'
import { renderToString } from 'react-dom/server'

import HomeView from '../src/components/HomeView'
import CardView from '../src/components/CardView'
import ResultView from '../src/components/ResultView'
import { ToastProvider } from '../src/components/ui/toast'
import { baseIdx, buildList, countsOf, nextWeakPos, priKey } from '../src/lib/quiz'
import { parseImport } from '../src/lib/exports'
import wordsJson from '../src/data/words.json'
import type { Word } from '../src/lib/types'

const words = wordsJson as Word[]
const noop = () => {}

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++
    console.log('  ✓ ' + name)
  } else {
    fail++
    console.log('  ✗ ' + name + (extra ? '  → ' + extra : ''))
  }
}

const wrap = (node: React.ReactNode) =>
  renderToString(<ToastProvider>{node}</ToastProvider>)

console.log('\n[1] 数据完整性')
check('词条总数 = 5877', words.length === 5877, String(words.length))
check('初中基础词 = 1846', words.filter((w) => w.bs === 1).length === 1846)
check('全部有音标', words.every((w) => w.p && w.p.length > 0))
check('全部有释义', words.every((w) => w.m && w.m.length > 0))
check('pri 字段齐全', words.every((w) => typeof w.pri === 'number'))

console.log('\n[2] 首页渲染')
const home = wrap(
  <HomeView
    words={words}
    counts={{ ok: 0, no: 0, done: 0, total: words.length }}
    range="all"
    order="asc"
    start={1}
    showPh
    showMean={false}
    speak={false}
    hasProgress={false}
    onRange={noop} onOrder={noop} onStart={noop}
    onShowPh={noop} onShowMean={noop} onSpeak={noop}
    onNew={noop} onResume={noop} onWeak={noop} onResetAll={noop}
    onImport={noop} onRestore={noop}
  />,
)
check('含「开始测试」', home.includes('开始测试'))
check('含「开始新一轮」', home.includes('开始新一轮'))
// SelectTrigger 显示当前选中项；选项列表由 Radix 在展开时才挂载，故断言选中值文本
check('范围下拉显示当前值（含条数）', home.includes(`全部 · ${words.length} 条`))
check('含「仅初中基础词汇」的下拉控件', home.includes('测试范围'))
check('顺序下拉显示当前值', home.includes('正序 A → Z'))
check('含快捷键 W', home.includes('跳到下一个不会'))
check('含触摸说明', home.includes('右滑'))
check('含词库条数', home.includes(String(words.length)))

console.log('\n[3] 答题页渲染（基础词）')
const baseWord = words.find((w) => w.bs === 1 && w.c > 0)!
const card = wrap(
  <CardView
    word={baseWord}
    wi={0}
    pos={0}
    total={100}
    counts={{ ok: 3, no: 2, done: 5, total: words.length }}
    reveal={false}
    showPh
    ans={{ 0: 0 }}
    onOk={noop} onNo={noop} onMean={noop} onSpeak={noop}
    onUndo={noop} onPrev={noop} onSkip={noop} onJumpWeak={noop} onFinish={noop}
  />,
)
check('显示单词 ' + baseWord.w, card.includes(baseWord.w))
check('显示音标', card.includes(baseWord.p.replace(/&/g, '&amp;')))
check('显示释义前不露出释义', !card.includes(baseWord.m))
check('含「初中基础」徽章', card.includes('初中基础'))
check('含「上次标记」胶囊', card.includes('上次标记'))
check('含 认识/不认识 按钮', card.includes('认识') && card.includes('不认识'))
check('含 释义 按钮（手机可点）', card.includes('释义'))
check('含 跳过/W 按钮', card.includes('跳过') && card.includes('下一个生词'))
check('含进度条 role=progressbar', card.includes('progressbar'))

console.log('\n[4] 答题页渲染（展开释义 + 高中词）')
const senWord = words.find((w) => !w.bs && w.lv === '课标·选择性必修' && w.m)!
const card2 = wrap(
  <CardView
    word={senWord} wi={1} pos={1} total={10}
    counts={{ ok: 1, no: 0, done: 1, total: words.length }}
    reveal showPh ans={{}}
    onOk={noop} onNo={noop} onMean={noop} onSpeak={noop}
    onUndo={noop} onPrev={noop} onSkip={noop} onJumpWeak={noop} onFinish={noop}
  />,
)
check('展开后显示释义', card2.includes(senWord.m))
check('非基础词不显示「初中基础」', !card2.includes('初中基础'))

console.log('\n[5] 结果页渲染')
const ans: Record<number, 0 | 1> = {}
for (let i = 0; i < 60; i++) ans[i] = i % 3 === 0 ? 0 : 1
const res = wrap(
  <ResultView
    words={words}
    ans={ans}
    idx={Array.from({ length: 60 }, (_, i) => i)}
    counts={{ ok: 40, no: 20, done: 60, total: words.length }}
    onBack={noop} onRetestWeak={noop} onHome={noop} toast={noop}
  />,
)
check('含「掌握情况」', res.includes('掌握情况'))
check('含掌握率百分比', res.includes('67%'), '期望 40/60=67%')
check('含导出按钮组', res.includes('生词 CSV') && res.includes('默写版 PDF'))
check('含「重测不会的词」', res.includes('重测'))
check('含单词清单', res.includes('单词清单'))
check('筛选下拉显示当前值', res.includes('全部层级') && res.includes('全部常用度') && res.includes('不会'))
check('含搜索框 id=filterText', res.includes('id="filterText"'))
check('含词频判语', res.includes('高频词') || res.includes('低频词'))
check('含基础段判语', res.includes('初中基础段') || res.includes('初中基础词'))

console.log('\n[6] 全部判语用例')
const mk = (n: number, weakRatio: number, weakIsBase: boolean) => {
  const a: Record<number, 0 | 1> = {}
  let marked = 0
  for (let i = 0; i < words.length && marked < n; i++) {
    if (weakIsBase && !words[i].bs) continue
    if (!weakIsBase && words[i].bs) continue
    a[i] = i / n < weakRatio ? 0 : 1
    marked++
  }
  return a
}
const cases: Array<[string, Record<number, 0 | 1>]> = [
  ['空答案', {}],
  ['全对', mk(100, 0, false)],
  ['一半不会', mk(100, 0.5, false)],
  ['只不会基础词', mk(200, 0.5, true)],
]
for (const [name, a] of cases) {
  let ok = 0, no = 0
  for (const k in a) (a[k] === 1 ? ok++ : no++)
  const html = wrap(
    <ResultView
      words={words} ans={a} idx={[]}
      counts={{ ok, no, done: ok + no, total: words.length }}
      onBack={noop} onRetestWeak={noop} onHome={noop} toast={noop}
    />,
  )
  check('判语用例：' + name + ' 渲染成功', html.length > 2000)
}

console.log('\n[7] 核心逻辑')
{
  const nAll = baseIdx(words, 'all').length
  const nCore = baseIdx(words, 'core').length
  const nCs = baseIdx(words, 'cs').length
  const nJunior = baseIdx(words, 'junior').length
  const nSenior = baseIdx(words, 'senior').length
  const nBridge = baseIdx(words, 'bridge').length
  check('范围 all = 全库', nAll === words.length, String(nAll))
  check('范围 junior = 1846', nJunior === 1846, String(nJunior))
  check('junior + senior = all', nJunior + nSenior === nAll, `${nJunior}+${nSenior}`)
  check('core < all', nCore > 0 && nCore < nAll, String(nCore))
  check('bridge < all', nBridge > 0 && nBridge < nAll, String(nBridge))
  check('cs = 课标层总数', nCs === words.filter((w) => (w.lv || '').indexOf('课标') >= 0).length, String(nCs))

  // 优先级排序：基础在最前，且段内按词频升序
  const pri = buildList(words, 'all', 'pri', 1, 'normal', {})
  const first = words[pri[0]]
  check('优先级排序首位是基础词', first.bs === 1, first.w)
  let mono = true
  for (let i = 1; i < pri.length; i++) {
    if (priKey(words[pri[i]]) < priKey(words[pri[i - 1]])) { mono = false; break }
  }
  check('优先级排序单调不减', mono)
  const baseCount = pri.filter((i) => words[i].bs === 1).length
  check('优先级排序把 1846 个基础词排在最前段', baseCount === 1846, String(baseCount))

  // 高频优先：the 应在最前
  const freq = buildList(words, 'all', 'freq', 1, 'normal', {})
  check('高频优先首位是 the', words[freq[0]].w === 'the', words[freq[0]].w)
  // 低频优先：末位是最生僻的
  const rare = buildList(words, 'all', 'rare', 1, 'normal', {})
  check('低频优先首位与高频相反', rare[0] !== freq[0])

  // 位置截断
  const from100 = buildList(words, 'all', 'asc', 100, 'normal', {})
  check('asc + 起始位置 100 → 少 99 个', from100.length === nAll - 99, String(from100.length))

  // 只测不会
  const ans0: Record<number, 0 | 1> = { 3: 0, 7: 0, 11: 1 }
  const weak = buildList(words, 'all', 'asc', 1, 'weak', ans0)
  check('weak 模式只取不会的词', weak.length === 2 && weak.every((i) => ans0[i] === 0), String(weak.length))

  // 计数
  const c = countsOf(words, ans0)
  check('countsOf ok/no/done', c.ok === 1 && c.no === 2 && c.done === 3, JSON.stringify(c))

  // 下一个生词
  const seq = [10, 20, 30, 40]
  const ansW: Record<number, 0 | 1> = { 20: 1, 30: 0, 40: 1 }
  check('nextWeakPos 跳过已会的', nextWeakPos(seq, ansW, 0) === 2, String(nextWeakPos(seq, ansW, 0)))
  check('nextWeakPos 绕回开头找未标记', nextWeakPos(seq, ansW, 2) === 0, String(nextWeakPos(seq, ansW, 2)))
  check('nextWeakPos 全都会时返回 -1', nextWeakPos(seq, { 10: 1, 20: 1, 30: 1, 40: 1 }, 0) === -1)

  // 参数化：关键交互映射的防回归
  check('the / a / in / be 都被判为基础词',
    ['the', 'a', 'in', 'be', 'as', 'at', 'by'].every((x) => {
      const w = words.find((y) => y.w.toLowerCase() === x)
      return w ? w.bs === 1 : true
    }))
  check('the 不在「跳过基础」范围内',
    !buildList(words, 'senior', 'asc', 1, 'normal', {}).some((i) => words[i].w === 'the'))
}

console.log('\n[8] 导入解析')
{
  const list = parseImport('abandon\tv. 放弃\nability, n. 能力\nApple\nthe\nthe\na.m.\n\n123\n')
  check('解析出行数与去重', list.length === 5, JSON.stringify(list.map((x) => x.w)))
  check('Tab 释义被捕获', list[0].m === 'v. 放弃', list[0].m)
  check('逗号释义被捕获', list[1].m === 'n. 能力', list[1].m)
  check('纯单词行 m 为空', list[2].m === '')
  check('忽略纯数字行', !list.some((x) => x.w === '123'))
}

console.log('\n' + '='.repeat(46))
console.log(`通过 ${pass} 项，失败 ${fail} 项`)
if (fail) process.exit(1)
