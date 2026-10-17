"""生成用于验证 PDF 排版的测试页。

从构建产物里取真实 CSS，用真实 buildDoc 结构造一份打印内容，
再用 Edge 无头打印成 PDF，用 Read 直接看渲染效果（序号是否与单词对齐）。
"""
import glob
import io
import json
import os
import re
import subprocess
import sys

ROOT = 'D:/Project/english'
DIST = os.path.join(ROOT, 'dist')
OUT_HTML = os.path.join(ROOT, 'data', '_print_test.html')
OUT_PDF = os.path.join(ROOT, 'data', '_print_test.pdf')

css_file = glob.glob(os.path.join(DIST, 'assets', '*.css'))[0]
css = open(css_file, encoding='utf-8').read()
print('CSS', os.path.basename(css_file), len(css), 'bytes')

words = json.load(open(os.path.join(ROOT, 'data', 'words.json'), encoding='utf-8'))
# 挑几个有代表性的：短词、长词、含音标长的、释义长的
picks = ['a.m.', 'abandon', 'able', 'aboard', 'absolutely', 'accommodation',
         'according to', 'X-ray', 'government', 'international', 'knowledge',
         'responsibility', 'the', 'eleven', 'hundredth', 'yesterday']
rows = []
byword = {w['w']: w for w in words}
for p in picks:
    if p in byword:
        w = byword[p]
        rows.append((w['w'], w['p'], w['m']))

# 补足到 40 个，模拟真实密度
for w in words:
    if len(rows) >= 40:
        break
    if w['w'] not in [r[0] for r in rows]:
        rows.append((w['w'], w['p'], w['m']))


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


cells = lambda r, no: (
    '<td class="c-no">%d</td>'
    '<td class="c-w" lang="en">%s</td>'
    '<td class="c-p" lang="en">%s</td>'
    '<td class="c-m">%s</td>' % (no, esc(r[0]), esc(r[1]), esc(r[2]))
)

body = ('<header class="doc-head"><div><h1>生词本</h1>'
        '<p class="sub">未掌握单词 · 含音标与释义</p></div>'
        '<div class="meta"><b>%d</b>个词 · 含初中基础 12 个<br>生成于 2026-10-17 09:10</div></header>' % len(rows))
body += ('<table><thead><tr>'
         '<th class="c-no">#</th><th class="c-w">单词</th><th class="c-p">音标</th><th class="c-m">释义</th>'
         '<th class="c-no">#</th><th class="c-w">单词</th><th class="c-p">音标</th><th class="c-m">释义</th>'
         '</tr></thead><tbody>')
for i in range(0, len(rows), 2):
    body += '<tr>' + cells(rows[i], i + 1)
    body += cells(rows[i + 1], i + 2) if i + 1 < len(rows) else '<td colspan="4" class="c-empty"></td>'
    body += '</tr>'
body += '</tbody></table>'
body += ('<footer class="doc-foot"><span>由「单词自测」生成</span>'
         '<span>已测 120 词 · 掌握率 62%</span></footer>')

html = ('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<style>%s</style></head><body>'
        '<div id="printArea">%s</div></body></html>' % (css, body))
open(OUT_HTML, 'w', encoding='utf-8').write(html)
print('written', OUT_HTML, len(html), 'bytes')

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
print('edge:', EDGE, os.path.exists(EDGE))

cmd = [EDGE, '--headless=new', '--disable-gpu', '--no-sandbox',
       '--user-data-dir=' + os.path.join(ROOT, 'data', '_edgeprofile'),
       '--no-pdf-header-footer', '--print-to-pdf=' + OUT_PDF,
       'file:///' + OUT_HTML.replace('\\', '/')]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
print('exit', r.returncode)
print((r.stderr or '')[-600:])
print('pdf exists:', os.path.exists(OUT_PDF),
      os.path.getsize(OUT_PDF) if os.path.exists(OUT_PDF) else 0)
