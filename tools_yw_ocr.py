"""OCR 义教课标（2022）附录3 词汇表。

扫描版无文本层，用 RapidOCR 逐页识别，按坐标重建「左栏读完读右栏」的顺序。
输出 data/yw_words.json： [{w, star(是否二级/小学词), page}]
"""
import io
import json
import re
import sys

import pymupdf
from PIL import Image

PDF = 'data/src/义务教育英语课程标准（2022年版）.pdf'
START = int(sys.argv[1]) if len(sys.argv) > 1 else 104
END = int(sys.argv[2]) if len(sys.argv) > 2 else 136
OUT = sys.argv[3] if len(sys.argv) > 3 else 'data/yw_words.json'
DPI = 220

from rapidocr_onnxruntime import RapidOCR
engine = RapidOCR()

doc = pymupdf.open(PDF)

# 每页正文里不该被当成单词的行
NOISE = re.compile(r'^(附录|义务教育|英语|课程标准|二级词汇表|三级词汇表|说明|'
                   r'本词汇表|根据核心|词根|标注|名词复数|数词|部分地理|不规则动词|'
                   r'为体现|加 ?100|确定|含二级|各地可|括号|词和短语|等。|tion\)|'
                   r'\d{1,3})$')

LETTER = re.compile(r'^[A-Z]$')


def clean_tokens(t):
    """把一个 OCR 文本块规整成候选单词列表；返回 [(词, 是否二级标记), ...]。"""
    t = t.strip()
    t = re.sub(r'\s+', ' ', t)
    star = t.endswith('*') or ' *' in t
    t = t.replace('*', '').strip()
    # 去掉括号补充：child (pl. children) / be (am, is, are) / PE (=physical education)
    t = re.sub(r'\([^)]*\)', '', t).strip()
    # 斜杠并列要拆开都收：a / an  → a, an
    parts = [p.strip() for p in re.split(r'\s*/\s*', t)] if '/' in t else [t]
    out = []
    for p in parts:
        p = p.strip(' .,;:')
        if not p or NOISE.match(p) or LETTER.match(p):
            continue
        # 只保留纯英文词条（允许连字符、撇号、空格短语）
        if not re.match(r"^[A-Za-z][A-Za-z\-'’ .]*$", p):
            continue
        if len(p) > 30:
            continue
        out.append((p, star))
    return out


all_rows = []
for pno in range(START, min(END, doc.page_count)):
    pix = doc[pno].get_pixmap(dpi=DPI)
    png = pix.tobytes('png')
    W, H = pix.width, pix.height
    res, _ = engine(png)
    if not res:
        print('page %d: no text' % pno)
        continue
    items = []
    for row in res:
        box, text, score = row[0], row[1], row[2]
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        try:
            sc = float(score)
        except (TypeError, ValueError):
            sc = 0.0
        items.append({'x': min(xs), 'y': min(ys), 't': text, 's': sc})
    # 两栏：以页宽中线切分
    mid = W * 0.5
    left = [it for it in items if it['x'] < mid - W * 0.06]
    right = [it for it in items if it['x'] >= mid - W * 0.06]
    left.sort(key=lambda d: d['y'])
    right.sort(key=lambda d: d['y'])
    n = 0
    for col in (left, right):
        for it in col:
            for w, star in clean_tokens(it['t']):
                all_rows.append({'w': w, 'star': 1 if star else 0,
                                 'page': pno, 'score': round(it['s'], 2)})
                n += 1
    print('page %d -> %d tokens (left %d / right %d)' % (pno, n, len(left), len(right)))

json.dump(all_rows, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('total tokens', len(all_rows), '->', OUT)
