"""对比义教课标(2022)三级词汇表 与我方基础词判定(bs)。

OCR 产物有系统性错误（l→i、rn→m），用词库做校验驱动的纠错，再统计。
"""
import json
import re
from collections import Counter

YW_END = 135          # 三级词汇表正文页码范围 PDF 索引 p104..p135

yw = json.load(open('data/yw_words.json', encoding='utf-8'))
yw = [x for x in yw if x['page'] <= YW_END]

words = json.load(open('data/words.json', encoding='utf-8'))


def nk(w):
    return re.sub(r'[^a-z]', '', (w or '').lower())


byk = {}
for x in words:
    byk.setdefault(nk(x['w']), x)


def cands(w):
    """给出 OCR 可能的正确拼写候选（按可信度排序）。"""
    out = [w]
    if w.startswith('i') and len(w) > 2:
        out.append('l' + w[1:])                  # iady → lady
    if w.startswith('I'):
        out.append('I')
    # rn 被识别成 m：aftemoon → afternoon, intemational → international
    for i, ch in enumerate(w):
        if ch in 'm':
            out.append(w[:i] + 'rn' + w[i + 1:])
    # m 被识别成 rn（少见）
    out.extend([w.replace('rn', 'm')])
    # 常见字母混淆
    out.append(w.replace('0', 'o').replace('1', 'l'))
    return out


def resolve(w):
    """返回 (纠正后的词, 是否在词库命中)。"""
    for c in cands(w):
        k = nk(c)
        if k and k in byk:
            return c, True
    return w, False


seen = {}
for x in yw:
    w, hit = resolve(x['w'])
    k = nk(w)
    if not k:
        continue
    if k not in seen:
        seen[k] = {'w': w, 'raw': x['w'], 'star': x['star'], 'hit': hit,
                   'page': x['page'], 'score': x['score']}
    elif x['star'] and not seen[k]['star']:
        seen[k]['star'] = 1

ywc = list(seen.values())
print('义教三级词表：OCR 原始 token %d → 去重 %d 条' % (len(yw), len(ywc)))
print('其中带 * 的二级(小学)词：%d 条' % sum(1 for x in ywc if x['star']))

in库 = [x for x in ywc if nk(x['w']) in byk]
不在库 = [x for x in ywc if nk(x['w']) not in byk]
print()
print('=' * 62)
print('课标词表在我方词库中命中：%d / %d = %.1f%%'
      % (len(in库), len(ywc), 100 * len(in库) / len(ywc)))
bs_hit = [x for x in in库 if byk[nk(x['w'])]['bs'] == 1]
print('判为「初中基础词」：%d / %d = %.1f%%'
      % (len(bs_hit), len(in库), 100 * len(bs_hit) / len(in库)))
star_hit = [x for x in in库 if x['star']]
print('带 * 的小学词中判为基础词：%d / %d = %.1f%%'
      % (sum(1 for x in star_hit if byk[nk(x['w'])]['bs'] == 1), len(star_hit),
         100 * sum(1 for x in star_hit if byk[nk(x['w'])]['bs'] == 1) / max(1, len(star_hit))))

miss = [x for x in in库 if byk[nk(x['w'])]['bs'] == 0]
print()
print('=' * 62)
print('【召回缺口】课标有、我们未判基础的：%d 条' % len(miss))
for x in sorted(miss, key=lambda x: byk[nk(x['w'])]['f'] or 99999):
    o = byk[nk(x['w'])]
    print('   %-14s star=%d jr=%-3d f=%-7d lv=%s' % (x['w'], x['star'], o['jr'], o['f'], o['lv']))

print()
print('=' * 62)
print('【词表有、词库无】纠错后仍未命中的：%d 条' % len(不在库))
print(' '.join(x['w'] for x in 不在库))

# 反向：我方判基础、课标没有的
ywk = {nk(x['w']) for x in ywc}
ours = [x for x in words if x['bs'] == 1]
extra = [x for x in ours if nk(x['w']) not in ywk]
print()
print('=' * 62)
print('【我方多判】判为基础但不在课标三级词表：%d 条 / 共 %d 条基础词' % (len(extra), len(ours)))
extra.sort(key=lambda x: x['f'] or 99999)
print('   其中非课标义务段层级的：')
ne = [x for x in extra if x['lv'] != '课标·基础']
print('   %d 条，前 60：' % len(ne))
print('   ' + ' '.join('%s(%s)' % (x['w'], x['lv']) for x in ne[:60]))
