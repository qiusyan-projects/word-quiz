"""解析 LinXueyuanStdio/DictionaryData 的 book.csv（分隔符为 >），建立词书索引。"""
import csv, json

rows = list(csv.reader(open('data/src/book.csv', encoding='utf-8')))
head = rows[0][0].split('>')
books = []
for r in rows[1:]:
    if not r or not r[0].strip():
        continue
    parts = r[0].split('>')
    if len(parts) < len(head):
        parts += [''] * (len(head) - len(parts))
    d = dict(zip(head, parts))
    books.append({
        'id': d.get('bk_id', '').strip(),
        'parent': d.get('bk_parent_id', '').strip(),
        'name': d.get('bk_name', '').strip(),
        'num': d.get('bk_item_num', '').strip(),
        'flag': d.get('bk_flag', '').strip(),
        'book': d.get('bk_book', '').strip(),
        'publisher': d.get('bk_publisher', '').strip(),
    })

print('books', len(books))
HIGH = '6512bd43d9caa6e02c990b0a'   # 高中英语
CET4 = 'c9f0f895fb98ab9159f51fd0'   # 大学英语四级词汇
CET6 = 'c20ad4d76fe97759aa27a0c9'   # 大学英语六级词汇
JUNIOR = 'd3d9446802a44259755d38e6'  # 初中英语（与高中英语平级的根分类）

# 散落在「老版词书」下的初中教材，靠名字捞回来
JUNIOR_NAME = ('七年级', '八年级', '九年级', '初一', '初二', '初三', '初中', '中考')


def subtree(root):
    kids = [b for b in books if b['parent'] == root]
    out = list(kids)
    for k in kids:
        out += subtree(k['id'])
    return out


jr_ids = [b['id'] for b in subtree(JUNIOR)] + [JUNIOR]
# 子树外、但名字明显是初中教材的（如「2007人教版初中九年级」）
jr_ids += [b['id'] for b in books
           if b['parent'] != JUNIOR
           and any(k in b['name'] for k in JUNIOR_NAME)]
# 小学教材不算基础词汇，排除
PRIMARY = '45c48cce2e2d7fbdea1afc51'
jr_ids = [i for i in jr_ids if i not in {b['id'] for b in subtree(PRIMARY)}]



# 收录量过大的「总表」没有筛选力（如收录 23885 词的《初中英语》），逐本剔除
byid = {b['id']: b for b in books}


def booknum(i):
    try:
        return int(byid.get(i, {}).get('num') or 0)
    except ValueError:
        return 0


jr_ids = [i for i in jr_ids if booknum(i) <= 6000]

idx = {
    'high': [b['id'] for b in subtree(HIGH)] + [HIGH],
    'cet4': [b['id'] for b in subtree(CET4)] + [CET4],
    'cet6': [b['id'] for b in subtree(CET6)] + [CET6],
    'junior': sorted(set(jr_ids)),
}
json.dump({'books': books, 'idx': idx}, open('data/src/books_index.json', 'w', encoding='utf-8'), ensure_ascii=False)

for k, v in idx.items():
    print(k, len(v))
    for bid in v:
        b = next((x for x in books if x['id'] == bid), None)
        if b:
            print('   ', bid, b['name'], b['num'])
