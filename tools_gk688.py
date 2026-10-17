"""提取「高考历年真题核心高频688」词表。

来源：DictionaryData 的第 9fc3d7152ba9336a670e36d0 号词书（584 本词书之一）。
该书内部用 bv_tag 分了两组：
    核心高频688词汇  → 579 条
    核心扩展110词汇  → 110 条

输出 data/gk688.json：{items: [{w, tier, tag, vid}]}
    tier: 2 = 核心高频，1 = 扩展
    vid:  词条在该词典数据里的 vc_id，构建时用它取音标释义（比 ECDICT 准）

注意：本脚本**不判断**这些词是否已在本词库中。
那个判断放在 tools_build_words.py 里做（按 used 集合），否则会形成循环依赖——
补录过的词会被当成「已存在」，再跑一遍就全不补了。
"""
import csv
import json
import re

BK = '9fc3d7152ba9336a670e36d0'


def nk(w):
    return re.sub(r'[^a-z]', '', (w or '').lower())


# 1) 关系表里取该书全部条目（vc_id → tag）
rel = {}
with open('data/src/relation/relation_book_word.csv', encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f, delimiter='>'):
        if row['bv_book_id'] == BK:
            tag = (row.get('bv_tag') or '').strip()
            tier = 2 if '核心高频' in tag else (1 if '扩展' in tag else 0)
            rel[row['bv_voc_id']] = {'tag': tag, 'tier': tier}
print('关系表条目', len(rel))

# 2) vc_id → 词形
id2w = {}
want = set(rel)
with open('data/src/lxy_word.csv', encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f, delimiter='>'):
        if row['vc_id'] in want:
            id2w[row['vc_id']] = (row['vc_vocabulary'] or '').strip()
print('已映射词形', len(id2w), '/', len(want))

# 3) 去重输出（同词形不同 vc_id 只留一条，取较高的 tier）
items = []
seen = {}
for vid, meta in rel.items():
    wtxt = id2w.get(vid, '')
    if not wtxt:
        continue
    k = nk(wtxt)
    if not k:
        continue
    if k in seen:
        if meta['tier'] > seen[k]['tier']:
            seen[k].update({'tier': meta['tier'], 'tag': meta['tag']})
        continue
    rec = {'w': wtxt, 'tier': meta['tier'], 'tag': meta['tag'], 'vid': vid}
    seen[k] = rec
    items.append(rec)

items.sort(key=lambda x: (-x['tier'], x['w'].lower()))
n2 = sum(1 for x in items if x['tier'] == 2)
n1 = sum(1 for x in items if x['tier'] == 1)
print('去重后 %d 条：核心高频 %d / 扩展 %d' % (len(items), n2, n1))

json.dump({'source': 'DictionaryData / 高考历年真题核心高频688',
           'book': BK, 'total': len(items), 'items': items},
          open('data/gk688.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('-> data/gk688.json')
