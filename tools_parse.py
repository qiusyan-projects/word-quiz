import json, re

raw = open('tmp_3500.txt', encoding='utf-8', errors='replace').read().replace('\r', '')
lines = raw.split('\n')

out = []
seen = set()
dropped = []
pat = re.compile(r"^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\-'\. ]*$")

i = 0
while i < len(lines):
    line = lines[i].strip()
    if line.startswith('['):
        word = lines[i - 1].strip() if i > 0 else ''
        meaning = lines[i + 1].strip() if i + 1 < len(lines) else ''
        ph = line
        i += 2
        if not word or not re.search('[A-Za-z]', word):
            continue

        # 去掉括号里的变体说明：a (an) -> a ；can (could) -> can
        w = re.split(r'\s*\(', word)[0].strip().strip(',')
        # 修复连字符拆行与重复：department -store -> department-store，best--seller -> best-seller
        w = re.sub(r'\s*-\s*', '-', w)
        w = re.sub(r'-{2,}', '-', w)
        # 同义写法取第一个：telephone-booth / telephone-box
        w = w.split('/')[0].strip() if '/' in w else w
        w = re.sub(r'\s+', ' ', w)
        # 脏数据：could modal / may modal
        w = re.sub(r'\s+modal$', '', w)
        m = re.sub(r'\s+', ' ', meaning).strip()
        if m.startswith('modal'):
            m = m[5:].strip()

        key = w.lower().replace('-', '').replace("'", '').replace('.', '').replace(' ', '')
        if not w or not m or not pat.match(w) or len(w) > 30:
            dropped.append(w or repr(word))
        elif key in seen:
            dropped.append(w + '(dup)')
        else:
            seen.add(key)
            out.append({'w': w, 'p': ph, 'm': m})
        i += 1
    else:
        i += 1

print('kept', len(out), 'dropped', len(dropped))
print('dropped sample:', dropped[:20])
print('phrases:', sum(1 for x in out if ' ' in x['w']))
print('no-ph:', sum(1 for x in out if not x['p'].strip('[]')))

json.dump(out, open('data/words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
with open('words.js', 'w', encoding='utf-8') as f:
    f.write('// 高考英语词汇表（单词 + 短语）：word / phonetic / meaning，共 %d 条\n' % len(out))
    f.write('window.WORDS = ')
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('ok')
