"""从《普通高中英语课程标准》PDF 附录2 提取官方词汇表。

支持：2017年版2020年修订（3000词）、2017年版2025年修订（3100词）
用法: python tools_build_official.py <pdf路径> <起始页索引> <结束页索引>
"""
import json, re, sys
from pypdf import PdfReader

path = sys.argv[1] if len(sys.argv) > 1 else 'data/src/普通高中英语课程标准日常修订版（2017年版2025年修订）.pdf'
START = int(sys.argv[2]) if len(sys.argv) > 2 else 75
END = int(sys.argv[3]) if len(sys.argv) > 3 else 131

STOP_MARK = 'COUNTRY'   # 词汇表结束、"国家名称"续表开始

reader = PdfReader(path)
print('reading', path, 'pages', len(reader.pages))

words = []
seen = set()
cur_letter = None
stopped = False

line_re = re.compile(r"^[A-Za-z][A-Za-z\-'\. /]*(\(.+\))?\s*\*{0,3}$")

for pi in range(START, END + 1):
    text = reader.pages[pi].extract_text() or ''
    if STOP_MARK in text:
        text = text.split(STOP_MARK)[0]
        stopped = True
    for raw in text.split('\n'):
        line = raw.replace('\u2002', ' ').strip()
        if not line:
            continue
        # 页眉 / 页脚 / 试卷水印 / 学校名
        if line.startswith('│') or '普通高中英语课程标准' in line:
            continue
        if line.startswith('{#') or line.startswith('{#'):
            continue
        if re.fullmatch(r'\d{1,3}', line):
            continue
        if re.fullmatch(r'[A-Z]', line):        # 字母分组标题
            cur_letter = line
            continue
        if not line_re.match(line):
            continue

        stars = len(re.search(r'\*{0,3}$', line).group())
        core = re.sub(r'\s*\*+\s*$', '', line).strip()

        alt = ''
        m = re.search(r'\((.+?)\)', core)
        if m:
            alt = m.group(1).strip()
            core = core[:m.start()].strip()
        # 2025版写法：a/an、color/color
        if '/' in core:
            parts = [x.strip() for x in core.split('/') if x.strip()]
            core = parts[0]
            if len(parts) > 1 and not alt:
                alt = parts[1]

        w = re.sub(r'\s+', ' ', core).strip()
        if not re.match(r"^[A-Za-z][A-Za-z\-'\. ]*$", w) or not w:
            continue
        key = w.lower().replace('-', '').replace("'", '').replace('.', '').replace(' ', '')
        if not key or key in seen:
            continue
        seen.add(key)

        level = {0: 'base', 1: 'req', 2: 'sel', 3: 'opt'}[stars]
        words.append({'w': w, 'lv': level, 'alt': alt, 'ltr': cur_letter})
    if stopped:
        break

print('extracted', len(words))
from collections import Counter
print(Counter(x['lv'] for x in words))
print(words[:5])
print(words[-5:])
json.dump(words, open('data/official_words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('saved data/official_words.json')
