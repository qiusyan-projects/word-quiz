# -*- coding: utf-8 -*-
"""探测各数据源的词频字段质量：覆盖率 + 排序是否合理"""
import csv
import json
import re
import sys

csv.field_size_limit(10 ** 7)
SRC = 'data/src'

# ---------- 我们词库里的词 ----------
our = json.load(open('data/words.json', encoding='utf-8'))
keys = [x['w'].strip().lower() for x in our]
KEYSET = set(keys)
print('本库词条 %d' % len(our))

# ---------- 1. DictionaryData ----------
lxy = {}
with open(SRC + '/lxy_word.csv', encoding='utf-8', errors='replace') as f:
    rd = csv.reader(f, delimiter='>')
    next(rd)
    for r in rd:
        if len(r) < 7:
            continue
        w = r[1].strip().lower()
        if w:
            lxy[w] = {
                'freq': float(r[4] or 0),
                'diff': float(r[5] or 0),
                'ack': float(r[6] or 0),
            }
print('DictionaryData 总词数 %d' % len(lxy))

# ---------- 2. ECDICT ----------
ecd = {}
with open(SRC + '/ecdict.csv', encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row['word'] or '').strip().lower()
        if not w:
            continue
        try:
            bnc = int(row['bnc'] or 0)
        except ValueError:
            bnc = 0
        try:
            frq = int(row['frq'] or 0)
        except ValueError:
            frq = 0
        ecd[w] = {
            'bnc': bnc, 'frq': frq,
            'collins': int(row['collins'] or 0), 'oxford': int(row['oxford'] or 0),
            'tag': row['tag'] or '', 'pos': row['pos'] or '',
        }
print('ECDICT 总词数 %d' % len(ecd))

# ---------- 覆盖率 ----------
def cov(d, key, nonzero=False):
    n = 0
    for w in KEYSET:
        v = d.get(w)
        if not v:
            continue
        if nonzero and not v[key]:
            continue
        n += 1
    return n

print('\n【对我们词库的覆盖率】')
print('  DictionaryData 命中 %d (%.1f%%)  其中有词频 %d  有认知率 %d'
      % (cov(lxy, 'freq'), cov(lxy, 'freq') / len(KEYSET) * 100,
         cov(lxy, 'freq', True), cov(lxy, 'ack', True)))
print('  ECDICT         命中 %d (%.1f%%)  其中有 bnc %d  有 frq %d  collins星级 %d  oxford %d'
      % (cov(ecd, 'bnc'), cov(ecd, 'bnc') / len(KEYSET) * 100,
         cov(ecd, 'bnc', True), cov(ecd, 'frq', True),
         cov(ecd, 'collins', True), cov(ecd, 'oxford', True)))

# ---------- 合理性抽查 ----------
print('\n【抽查：常见词的三个指标】')
for w in ['the', 'abandon', 'computer', 'apple', 'water', 'evaluate', 'zebra', 'resolutely']:
    a = lxy.get(w)
    b = ecd.get(w)
    print('  %-12s lxy_freq=%-8s lxy_ack=%-8s | bnc=%-7s frq=%-6s collins=%s' % (
        w,
        '%.4f' % a['freq'] if a else '-',
        '%.3f' % a['ack'] if a else '-',
        b['bnc'] if b else '-', b['frq'] if b else '-',
        b['collins'] if b else '-'))

# ---------- 按频排序，看高频端是否合理 ----------
print('\n【ECDICT frq 排名前 15（越小越高频）】')
items = [(w, d['frq']) for w, d in ecd.items() if d['frq'] > 0]
items.sort(key=lambda kv: kv[1])
for w, v in items[:15]:
    print('  %-12s frq=%-6d bnc=%d' % (w, v, ecd[w]['bnc']))

print('\n【ECDICT bnc 最高 15 个】')
items = [(w, d['bnc']) for w, d in ecd.items() if d['bnc'] > 0]
items.sort(key=lambda kv: -kv[1])
for w, v in items[:15]:
    print('  %-12s bnc=%-8d frq=%d' % (w, v, ecd[w]['frq']))

# ---------- 我们词库内，按 frq 分档 ----------
print('\n【本库词条按 ECDICT frq 分档】')
buckets = {'1-1000': 0, '1001-3000': 0, '3001-7000': 0, '7001-15000': 0, '>15000': 0, '无': 0}
for w in KEYSET:
    d = ecd.get(w)
    v = d['frq'] if d else 0
    if not v:
        buckets['无'] += 1
    elif v <= 1000:
        buckets['1-1000'] += 1
    elif v <= 3000:
        buckets['1001-3000'] += 1
    elif v <= 7000:
        buckets['3001-7000'] += 1
    elif v <= 15000:
        buckets['7001-15000'] += 1
    else:
        buckets['>15000'] += 1
for k, v in buckets.items():
    print('  %-10s %d' % (k, v))

# ---------- tag 字段（考试标签） ----------
print('\n【我们词库里 ECDICT tag 分布 top10】')
from collections import Counter
c = Counter()
for w in KEYSET:
    d = ecd.get(w)
    if d and d['tag']:
        for t in d['tag'].split():
            c[t] += 1
for t, n in c.most_common(10):
    print('  %-12s %d' % (t, n))
