import type { Mark, Word } from './types'

export interface ExportRow {
  word: string
  ph: string
  mean: string
  lv: string
  st: string
  frq: number | string
  star: number | string
  ack: number | string
  bs: string
  jr: number | string
}

function pad2(n: number) {
  return (n < 10 ? '0' : '') + n
}

export function dateStr() {
  const d = new Date()
  return (
    d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' +
    pad2(d.getHours()) + pad2(d.getMinutes())
  )
}

export function nowStr() {
  const d = new Date()
  return (
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  )
}

export function rowsFor(
  words: Word[],
  ans: Record<number, Mark>,
  onlyWeak: boolean,
): ExportRow[] {
  const out: ExportRow[] = []
  for (let i = 0; i < words.length; i++) {
    const a = ans[i]
    if (a === undefined) continue
    if (onlyWeak && a !== 0) continue
    const w = words[i]
    out.push({
      word: w.w,
      ph: w.p || '',
      mean: w.m || '',
      lv: w.lv || '',
      st: a === 1 ? '会' : '不会',
      frq: w.f || '',
      star: w.c || '',
      ack: w.a || '',
      bs: w.bs ? '是' : '',
      jr: w.jr || '',
    })
  }
  return out
}

const csvCell = (s: unknown) => {
  const t = String(s == null ? '' : s)
  return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
}

export function download(content: string, filename: string, mime?: string) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 500)
}

export function exportCsv(rows: ExportRow[], onlyWeak: boolean) {
  // 生词本按词频从高到低排，先背最该背的
  const data = onlyWeak
    ? rows.slice().sort((a, b) => (Number(a.frq) || 99999) - (Number(b.frq) || 99999))
    : rows
  const head = onlyWeak
    ? '单词,音标,释义,常用度(1-5星),词频排名,认知率%,初中基础词,层级\n'
    : '单词,音标,释义,常用度(1-5星),词频排名,认知率%,初中基础词,层级,状态\n'
  const body = data
    .map((r) => {
      const base = [
        csvCell(r.word), csvCell(r.ph), csvCell(r.mean),
        csvCell(r.star), csvCell(r.frq), csvCell(r.ack), csvCell(r.bs), csvCell(r.lv),
      ]
      if (!onlyWeak) base.push(csvCell(r.st))
      return base.join(',')
    })
    .join('\n')
  download(
    '\ufeff' + head + body,
    (onlyWeak ? '生词-不会-' : '单词测试结果-') + dateStr() + '.csv',
    'text/csv;charset=utf-8',
  )
}

export function exportTxt(rows: ExportRow[]) {
  const body = rows
    .slice()
    .sort((a, b) => (Number(a.frq) || 99999) - (Number(b.frq) || 99999))
    .map((r) => r.word)
    .join('\n')
  download(body, '生词-不会-' + dateStr() + '.txt')
}

const esc = (s: unknown) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  )

/** 生成打印用的文档 HTML：A4、一行两词、默写版答案见末页 */
export function buildDoc(rows: ExportRow[], quiz: boolean, rate: number, tested: number) {
  const nb = rows.filter((r) => r.bs === '是').length
  let html =
    '<header class="doc-head"><div>' +
    '<h1>' + (quiz ? '生词默写本' : '生词本') + '</h1>' +
    '<p class="sub">' +
    (quiz ? '先看单词回想释义，答案见末页' : '未掌握单词 · 含音标与释义') +
    '</p></div><div class="meta"><b>' + rows.length + '</b>个词' +
    (nb ? ' · 含初中基础 ' + nb + ' 个' : '') +
    '<br>生成于 ' + esc(nowStr()) + '</div></header>'

  // lang="en" 是必需的：Chrome 只在带正确 lang 的元素上应用 hyphens，
  // 否则超长单词会被任意位置截断（governmen t）而不是按音节断（govern-ment）
  const cells = (r: ExportRow, no: number) =>
    '<td class="c-no">' + no + '</td>' +
    '<td class="c-w" lang="en">' + esc(r.word) + '</td>' +
    '<td class="c-p" lang="en">' + esc(r.ph) + '</td>' +
    '<td class="' + (quiz ? 'c-blank' : 'c-m') + '">' + (quiz ? '' : esc(r.mean)) + '</td>'

  html += '<table><thead><tr>' +
    '<th class="c-no">#</th><th class="c-w">单词</th><th class="c-p">音标</th>' +
    '<th class="' + (quiz ? 'c-blank' : 'c-m') + '">' + (quiz ? '默写（中文释义）' : '释义') + '</th>' +
    '<th class="c-no sep">#</th><th class="c-w">单词</th><th class="c-p">音标</th>' +
    '<th class="' + (quiz ? 'c-blank' : 'c-m') + '">' + (quiz ? '默写（中文释义）' : '释义') + '</th>' +
    '</tr></thead><tbody>'

  for (let i = 0; i < rows.length; i += 2) {
    html += '<tr>' + cells(rows[i], i + 1)
    html += rows[i + 1] ? cells(rows[i + 1], i + 2) : '<td colspan="4" class="c-empty"></td>'
    html += '</tr>'
  }
  html += '</tbody></table>'

  if (quiz) {
    html += '<section class="answers"><h2>答案</h2><div class="ans-col">' +
      rows.map((r, j) =>
        '<div><b>' + (j + 1) + '. ' + esc(r.word) + '</b> <span>' + esc(r.mean) + '</span></div>',
      ).join('') +
      '</div></section>'
  }

  html += '<footer class="doc-foot"><span>由「单词自测」生成</span>' +
    '<span>已测 ' + tested + ' 词 · 掌握率 ' + rate + '%</span></footer>'
  return html
}

export function exportPdf(html: string, count: number, onToast: (m: string) => void) {
  const area = document.getElementById('printArea')
  if (!area) return
  area.innerHTML = html
  onToast('已生成 ' + count + ' 词的 PDF，在打印窗口选择「另存为 PDF」')
  setTimeout(() => window.print(), 120)
}

/** 解析导入文本：每行 单词[Tab/逗号/竖线]释义，或仅单词 */
export function parseImport(text: string): Word[] {
  const out: Word[] = []
  const seen = new Set<string>()
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.split(/\t|,|\|/)
    const w = (m[0] || '').trim()
    if (!w || !/[A-Za-z]/.test(w)) continue
    const key = w.toLowerCase().replace(/[^a-z]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      w,
      p: '',
      m: (m.slice(1).join(' ').trim()) || '',
      lv: '自定义',
      src: 'custom',
      h: 0, xh: 0, tier: 9, jr: 0, bs: 0, f: 0, c: 0, a: 0, pri: 9, core: 0,
    })
  }
  return out
}
