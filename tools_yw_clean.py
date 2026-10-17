"""把义教课标(2022)三级词汇表的 OCR 结果整理成正式数据文件 data/edu_junior.json。

只做「表内有 → 是基础词」的单向校正，故 OCR 的漏词/错词不会造成误降级。
未命中词库的条目逐条人工确认（见 EXTRA），OCR 噪声丢弃。
"""
import json
import re

YW_END = 135

# OCR 噪声（非真实英文词或明显错识），丢弃
NOISE = {'affter', 'poou', 'pooj', 'pou', 'ssell', 'ods', 'il', 'lef', 'e', 'hil',
         'pos', 'gif', 'comer'}

# 三级词表收录、但词库（高中课标+星火+衔接）没有的词 —— 逐条人工确认后补录
EXTRA = ['empress', 'policemen', 'yogurt',
         'eleven', 'fourteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
         'sixty', 'seventy', 'eighty',
         'sixth', 'seventh', 'eighth', 'tenth',
         'eleventh', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth',
         'seventeenth', 'eighteenth', 'nineteenth',
         'thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth',
         'eightieth', 'ninetieth', 'hundredth']

yw = [x for x in json.load(open('data/yw_words.json', encoding='utf-8')) if x['page'] <= YW_END]
words = json.load(open('data/words.json', encoding='utf-8'))


def nk(w):
    return re.sub(r'[^a-z]', '', (w or '').lower())


byk = {nk(x['w']) for x in words}

# 英式/美式常见差异，用于匹配（课标统一用英式）
UK2US = [('our', 'or'), ('re', 'er'), ('ise', 'ize'), ('ogue', 'og'),
         ('ll', 'l'), ('ae', 'e'), ('oe', 'e'), ('yoghurt', 'yogurt')]


def variants(w):
    out = {w}
    lw = w.lower()
    for a, b in UK2US:
        if a in lw:
            out.add(lw.replace(a, b))
    return out


def fix_ocr(w):
    """词库校验驱动的 OCR 纠错。"""
    for c in ([w] + (['l' + w[1:]] if w.startswith('i') and len(w) > 2 else [])
              + [w[:i] + 'rn' + w[i + 1:] for i, ch in enumerate(w) if ch == 'm']
              + [w.replace('rn', 'm')]):
        if nk(c) in byk:
            return c
    return w


seen = {}
for x in yw:
    raw = x['w']
    if nk(raw) in NOISE:
        continue
    w = fix_ocr(raw)
    k = nk(w)
    if not k or len(k) < 2:
        continue
    if k not in seen or (x['star'] and not seen[k]['star']):
        seen[k] = {'w': w, 'star': x['star']}

items = sorted(seen.values(), key=lambda d: d['w'].lower())
print('三级词表整理后：%d 条（含 * 的二级/小学词 %d 条）'
      % (len(items), sum(1 for x in items if x['star'])))

hit = sum(1 for x in items
          if any(nk(v) in byk for v in variants(x['w'])))
print('与词库匹配：%d / %d = %.1f%%' % (hit, len(items), 100 * hit / len(items)))

json.dump({'source': '教育部《义务教育英语课程标准（2022年版）》附录3 三级词汇表',
           'declared': 1600, 'words': items, 'extra': EXTRA},
          open('data/edu_junior.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0)
print('-> data/edu_junior.json')
