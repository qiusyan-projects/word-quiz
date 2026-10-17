"""合成最终词库（多层权重）

L1 教育部《普通高中英语课程标准（2017年版2020年修订）》附录2 —— 官方，必收
L2 星火《最新高考词汇必背 乱序版》(5233) —— 用户指定高权重高考词书
L3 人教/外研/北师大/牛津正版教材与其它主流高考词书 —— 投票 ≥ MIN_BOOKS
L4 CET4 衔接 —— 四级词书中高频且高中段未覆盖
L5 CET6 衔接 —— 六级词书中高频且前面未覆盖

音标：LinXueyuanStdio/DictionaryData 英式 → 美式 → ECDICT
释义：DictionaryData 中文 → ECDICT 中文
"""
import csv, json, os, re, glob, zipfile
from collections import defaultdict

SRC = 'data/src'
csv.field_size_limit(10 ** 7)

XH_BOOK = 'd395771085aab05244a4fb8f'   # 星火最新高考词汇必背 乱序版
MIN_HITS_XH = 0                         # 星火高考词书全收
MIN_BOOKS = 12                          # 教材/词书共识层门槛
CET4_MIN, CET6_MIN = 6, 10
CET4_CAP, CET6_CAP = 1200, 400
JR_MIN = 8                              # 判定「基础词汇」：出现在多少本初中词书里
# 课标词表以原形归并动词变形（用 be 代表 is/am/are/was/were），这些变形既不在义务段词表里、
# 教材命中数又偏低，会整批掉进「高中及以上」范围。单独兜底。
VERB_FORMS = {'is', 'am', 'are', 'was', 'were', 'been'}  # 不含 being：该词条主要义项是名词「生物/存在」
# 词库数据源缺失音标的少数词，手工补（缩写与不规则复数）
MANUAL_PH = {'policemen': 'pəˈliːsmən', 'ai': 'ˌeɪ ˈaɪ', 'bce': 'ˌbiː siː ˈiː'}  # key 用小写


def nk(w):
    return re.sub(r'[^a-z]', '', (w or '').lower())


# 课标统一用英式拼写，词库侧可能是美式，做归一后再比对
UK2US = [('yoghurt', 'yogurt'), ('our', 'or'), ('re', 'er'), ('ise', 'ize'),
         ('ogue', 'og'), ('ll', 'l'), ('ae', 'e'), ('oe', 'e')]


def variants(w):
    out = {w.lower()}
    for a, b in UK2US:
        if a in w.lower():
            out.add(w.lower().replace(a, b))
    return out


def nk_variants(w):
    return {nk(v) for v in variants(w)}


IPA_OK = re.compile(r"^[\[\]/ˈˌː\.a-zɡŋʃʒθðɒɔəɑʊʌæɪɛɜɚɜ̃()\d '\- ]+$")
# 必须是真 IPA：含方括号、重音符或 IPA 专用字符，否则是伪音标（em、a:ei 之类）
IPA_MARK = re.compile(r"[\[\]ˈˌːəɑɒɔʊʌæɪɛɜʃʒθðŋɡ]")
# 西里尔混入（俄语键盘录入的假 IPA）
CYR = {'ә': 'ə', 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'u',
       'һ': 'h', 'Ә': 'ə', 'А': 'a', 'Е': 'e', 'О': 'o', 'Р': 'p', 'С': 'c', 'Х': 'x',
       'У': 'u', 'і': 'i', 'І': 'I', 'ѕ': 's', 'Ѕ': 'S', 'ӏ': 'l', 'ԁ': 'd', 'ԛ': 'q'}


def fix_ipa(p):
    """修正混入的西里尔字符 + 还原 ECDICT 的 ASCII 音标写法；无法还原则视为无效。"""
    p = (p or '').strip()
    if not p:
        return ''
    bad = [c for c in p if '\u0400' <= c <= '\u04FF' or '\u0500' <= c <= '\u052F']
    if bad:
        out = []
        for c in p:
            if c in CYR:
                out.append(CYR[c])
            elif ('\u0400' <= c <= '\u04FF') or ('\u0500' <= c <= '\u052F'):
                return ''          # 认不出的西里尔 → 丢弃
            else:
                out.append(c)
        p = ''.join(out)
    # ECDICT 用 ASCII 近似记音标：半角冒号表长音、各种撇号变体表重音、^ 是转换噪声。
    # 这些不还原的话会被 IPA 校验整批挡掉（eleven 的 i'levn、fortieth 的 'fɒ:tiiθ）。
    # 注意撇号是多种码位：ASCII ' / U+02BC 修饰符撇号 / U+2019 右单引号
    p = p.replace(':', 'ː').replace('^', '')
    for q in ("'", '\u02bc', '\u2019', '\u2018', '`', '\u00b4'):
        p = p.replace(q, 'ˈ')
    p = re.sub(r'ˈ{2,}', 'ˈ', p)
    p = p.lstrip('.')                  # 残留的音节分隔点：.nainˈtiːn → nainˈtiːn
    return p


def valid_ph(p):
    p = fix_ipa(p)
    if len(p) < 2 or len(p) > 46:      # ðə / iə 这类单音节合法音标只有两个字符
        return ''
    if re.search(r'[\u4e00-\u9fff,;]', p):
        return ''
    if not IPA_OK.match(p):
        return ''
    # 必须含音标字母——但「字母」不限于 ASCII：ðə / ˈæʃ 全由 IPA 专用字符组成，
    # 早期只认 [a-z] 会把这些合法音标整批判死
    if not re.search(r'[a-zɑɒɔəæɪɛɜʊʌʃʒθðŋɡ]', p):
        return ''
    if not IPA_MARK.search(p):
        return ''
    return p


POS = r'(?:n|v|vt|vi|adj|adv|prep|pron|conj|abbr|aux|art|int|num|pl|vt\.|aux\.|pron\.)'


def clean_mean(t, maxlen=46):
    """压缩中文释义：取前 1-2 个有效义项，剔除人名/地名/国别标注。"""
    t = re.sub(r'\\+[nrt]', ' ', t or '')           # 字面 \n
    t = re.sub(r'\s+', ' ', t).strip()
    if not t:
        return ''
    t = t.replace(';', '；').replace('，', ',')
    t = re.sub(r'\s*/\s*', '；', t)
    # 剔除 ECDICT 塞进释义的 [域]/[军] 段：域名国家代码与军事缩写属于纯污染
    # （is → "prep.是 [域] Iceland ,冰岛 [军] Internal Security,治安"）。
    # [计]/[商]/[医] 等学科标注是有效信息，保留。
    t = re.sub(r'\[(?:域|军)\][^\[；]*', '', t)
    # 剔除尾部残留的「英文,中文」国家/地名（at → "prep.在,于,向,对准；Austria,奥地利"）
    t = re.sub(r'[;；]?\s*[A-Z][A-Za-z .\-]*,\s*[\u4e00-\u9fff]{2,10}\s*$', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    if not t:
        return ''
    # 在词性标记前插分隔符
    t = re.sub(r'(?<=[\u4e00-\u9fff，,；])\s*(?=' + POS + r'\.)', '\x01', t)
    t = re.sub(r',\s*(?=' + POS + r'\.)', '\x01', t)
    parts = [p.strip(' ,；') for p in re.split(r'\x01|；', t) if p.strip(' ,；')]
    kept = []
    for p in parts:
        if re.search(r'人名|地名|姓氏|国家|货币|符号|简称|参见', p):
            continue
        p = re.sub(r'\s+', ' ', p).strip()
        if not p:
            continue
        # 单个义项内堆了太多同义词时截短：n.咽,淹没,吞没,取消,忍受 → 取前 4
        mm = re.match(r'^(' + POS + r'\.\s*)(.*)$', p)
        if mm and len(mm.group(2)) > 14:
            syns = [s for s in re.split(r'[,，]', mm.group(2)) if s.strip()][:4]
            p = mm.group(1) + ','.join(syns)
        kept.append(p)
        if sum(len(x) for x in kept) >= maxlen or len(kept) >= 2:
            break
    if not kept:
        kept = [re.sub(r'\s+', ' ', t).strip()]
    m = '；'.join(kept)
    return m[:maxlen + 18]


# ---------------- 1. 词书关系 ----------------
rel_dir = os.path.join(SRC, 'relation')
if not glob.glob(os.path.join(rel_dir, '**', '*.*'), recursive=True):
    os.makedirs(rel_dir, exist_ok=True)
    with zipfile.ZipFile(os.path.join(SRC, 'lxy_relation_book_word.zip')) as z:
        z.extractall(rel_dir)
rel_files = [f for f in glob.glob(os.path.join(rel_dir, '**', '*.*'), recursive=True)]
print('relation files:', [os.path.basename(f) for f in rel_files])

idx = json.load(open(os.path.join(SRC, 'books_index.json'), encoding='utf-8'))
HIGH = set(idx['idx']['high'])
CET4 = set(idx['idx']['cet4'])
CET6 = set(idx['idx']['cet6'])
JUNIOR = set(idx['idx'].get('junior', []))
books_all = {b['id']: b for b in idx['books']}
TB_TAGS = ('人教版', '外研社', '北师大版', '牛津')

xh = set()
high_cnt = defaultdict(int)
tb_cnt = defaultdict(int)
cet4_cnt = defaultdict(int)
cet6_cnt = defaultdict(int)
junior_cnt = defaultdict(int)

for f in rel_files:
    with open(f, encoding='utf-8', errors='replace') as fh:
        for line in fh:
            p = line.rstrip('\n').split('>')
            if len(p) < 2:
                continue
            # 关系表结构：bv_id > bv_book_id > bv_voc_id > flag > tag > order
            bid, wid = p[1].strip(), p[2].strip()
            if len(bid) < 16 or len(wid) < 16:
                continue
            if bid == XH_BOOK:
                xh.add(wid)
            if bid in HIGH:
                high_cnt[wid] += 1
                if any(t in books_all.get(bid, {}).get('name', '') for t in TB_TAGS):
                    tb_cnt[wid] += 1
            if bid in CET4:
                cet4_cnt[wid] += 1
            if bid in CET6:
                cet6_cnt[wid] += 1
            if bid in JUNIOR:
                junior_cnt[wid] += 1

print('星火词条 %d | 其它高中 %d | 四级 %d | 六级 %d | 初中 %d'
      % (len(xh), len(high_cnt), len(cet4_cnt), len(cet6_cnt), len(junior_cnt)))

# ---------------- 2. 拼写 / 音标 / 词频 ----------------
words = {}
with open(os.path.join(SRC, 'lxy_word.csv'), encoding='utf-8', errors='replace') as fh:
    rd = csv.reader(fh, delimiter='>')
    for i, row in enumerate(rd):
        if i == 0 or len(row) < 7:
            continue
        words[row[0]] = {'w': row[1].strip(), 'uk': row[2].strip(), 'us': row[3].strip(),
                         'freq': row[4].strip(), 'ack': row[6].strip()}
print('词表条目', len(words))

trans = {}
with open(os.path.join(SRC, 'lxy_word_translation.csv'), encoding='utf-8', errors='replace') as fh:
    for r in csv.DictReader(fh):
        w = (r.get('word') or '').strip()
        t = (r.get('translation') or '').strip()
        if w and t:
            trans.setdefault(w, t)
print('释义条目', len(trans))

# ---------------- 3. ECDICT 兜底 ----------------
official = json.load(open('data/official_words.json', encoding='utf-8'))
OFFICIAL_KEY = {nk(x['w']): x for x in official}

# 高考历年真题核心高频688（DictionaryData 词书 9fc3d715）—— 唯一带真题血统的考频信号
# 该书 689 条，其中 24 个是派生形式（exhausted / thoroughly / similarity…），
# 本词库以原形为主、收不了这些派生形，需要在 L5 之后补录。
GK = json.load(open('data/gk688.json', encoding='utf-8'))
GK_KEYS = {}                      # nk(word) -> 2 核心高频 / 1 扩展
GK_ITEMS = []
for it in GK['items']:
    k = nk(it['w'])
    if k:
        GK_KEYS[k] = max(GK_KEYS.get(k, 0), it['tier'])
    GK_ITEMS.append(it)
print('高考真题高频688 %d 条（核心 %d / 扩展 %d）→ 归一键 %d'
      % (len(GK_ITEMS),
         sum(1 for x in GK_ITEMS if x['tier'] == 2),
         sum(1 for x in GK_ITEMS if x['tier'] == 1),
         len(GK_KEYS)))

# 义教课标（2022）三级词汇表 —— 官方认定的义务教育阶段(含初中)词汇
EDU = json.load(open('data/edu_junior.json', encoding='utf-8'))
EDU_KEYS = set()
for it in EDU['words']:
    EDU_KEYS |= nk_variants(it['w'])
EDU_EXTRA = EDU['extra']
for w in EDU_EXTRA:
    EDU_KEYS |= nk_variants(w)
print('义教课标三级词表 %d 条（含 * 二级/小学 %d 条）→ 归一键 %d'
      % (len(EDU['words']), sum(1 for x in EDU['words'] if x['star']), len(EDU_KEYS)))

want_keys = {nk(x['w']) for x in official}
for w in EDU_EXTRA:                      # 补录词要从 ECDICT 取音标与释义
    want_keys |= nk_variants(w)
for it in GK_ITEMS:
    want_keys.add(nk(it['w']))
for wid in set(xh) | set(high_cnt) | set(cet4_cnt) | set(cet6_cnt):
    e = words.get(wid)
    if e and e['w']:
        want_keys.add(nk(e['w']))

def toint(v):
    try:
        return int(v or 0)
    except ValueError:
        return 0


ecd = {}
with open(os.path.join(SRC, 'ecdict.csv'), encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip()
        if not w:
            continue
        k = nk(w)
        if k in want_keys:
            if k in ecd:
                # 同一归一化 key 会撞上多条（Earth 与 earth、a.m. 与 am）：先到的留下音标/释义，
                # 但后来的若带词频/音标/释义而先前的缺，则补上——否则 the / earth 这类
                # 会因为先到的专有名词条目音标为空而整条丢失音标。
                old = ecd[k]
                if not old['frq']:
                    old['frq'] = toint(row.get('frq'))
                if not old['bnc']:
                    old['bnc'] = toint(row.get('bnc'))
                if not old['p']:
                    old['p'] = (row.get('phonetic') or '').strip()
                if not old['m']:
                    old['m'] = clean_mean(row.get('translation') or row.get('definition'))
                continue
            ecd[k] = {'p': (row.get('phonetic') or '').strip(),
                      'm': clean_mean(row.get('translation') or row.get('definition')),
                      'frq': toint(row.get('frq')),      # 当代语料库词频排名，1=最常用
                      'bnc': toint(row.get('bnc')),      # BNC 语料库词频排名
                      'col': toint(row.get('collins'))}  # 柯林斯星级 1-5
print('ECDICT 命中', len(ecd))

# ---------------- 4. 组装 ----------------
LEVEL = {'base': '课标·基础', 'req': '课标·必修', 'sel': '课标·选择性必修'}

out = []
used = set()


def push(wid, w, lv, src, hits, tier=9):
    key = nk(w)
    if not key or key in used:
        return False
    if not re.match(r"^[A-Za-z][A-Za-z\-'\. ]*$", w) or len(w) > 28:
        return False
    uk = us = ''
    d = words.get(wid)
    if d:
        uk, us = d['uk'], d['us']
    m = clean_mean(trans.get(w, ''))
    g = ecd.get(key, {})
    if not m:
        m = g.get('m', '')
    # 音标优先级：DictionaryData 英式 > 美式 > ECDICT（后者不少条目是西里尔假音标）
    cands = [uk, us, g.get('p', '')]
    p = ''
    for c in cands:
        v = valid_ph(c)
        if v:
            p = v
            break
    if not p:
        p = MANUAL_PH.get(w.lower(), '')
    # 统一成方括号写法，避免 DictionaryData(带[]) 与 ECDICT(裸串) 混排
    if p and not p.startswith('[') and not p.startswith('/'):
        p = '[' + p + ']'
    # 词频排名：frq 与 bnc 两个语料库各自都有离群值（queen 在 frq 里 43081、bnc 里 1223），
    # 取两者较小值可自动剔除离群——两个语料库只要有一个认为它常用，就采信常用的那个。
    a1, a2 = g.get('frq', 0), g.get('bnc', 0)
    if a1 and a2:
        frq = min(a1, a2)
    else:
        frq = a1 or a2
    # 常用度星级：优先柯林斯（人工分级），缺失时按柯林斯自家的绝对阈值折算
    col = g.get('col', 0)
    if not col:
        col = (5 if frq and frq <= 700 else 4 if frq and frq <= 2000
               else 3 if frq and frq <= 3200 else 2 if frq and frq <= 4800
               else 1 if frq and frq <= 6700 else 0)
    ack = 0
    if d:
        try:
            ack = int(round(float(d['ack'] or 0) * 100))
        except ValueError:
            ack = 0
    used.add(key)
    out.append({'w': w, 'p': p, 'm': m, 'lv': lv, 'src': src, 'h': hits,
                'xh': 1 if wid in xh else 0, 'tier': tier,
                'jr': junior_cnt.get(wid, 0), 'bs': 0,
                'f': frq, 'c': col, 'a': ack})
    return True


# 拼写 → vc_id 映射，供官方层取音标
by_word = {}
for wid, d in words.items():
    by_word.setdefault(nk(d['w']), wid)

# L1 官方课标（2025 修订版）
for x in official:
    push(by_word.get(nk(x['w']), ''), x['w'], LEVEL[x['lv']], 'cs', 0, tier=1)

# L1b 义教课标（2022）三级词表里词库缺失的词（数词/序数词/empress 等），补进来
n_edu = 0
for w in EDU_EXTRA:
    if push('', w, '义教课标·基础', 'edu_yw', 0, tier=1):
        n_edu += 1
print('义教课标补录 %d 条' % n_edu)

# 回填词书命中数（官方层是按单词入表的，没有 vc_id）
for item in out:
    wid = by_word.get(nk(item['w']))
    if wid:
        item['h'] = high_cnt.get(wid, 0)
        item['xh'] = 1 if wid in xh else 0
        item['jr'] = junior_cnt.get(wid, 0)

# L2 星火高考词汇（按命中本数降序，便于切分核心层）
n2 = 0
xh_sorted = sorted(xh, key=lambda wid: (-high_cnt.get(wid, 0), wid))
for wid in xh_sorted:
    d = words.get(wid)
    if not d or nk(d['w']) in OFFICIAL_KEY:
        continue
    if push(wid, d['w'], '高考词书', 'xh', high_cnt.get(wid, 0), tier=2):
        n2 += 1

# L3 其余高中词书 / 教材共识
n3 = 0
for wid, c in sorted(high_cnt.items(), key=lambda kv: (-kv[1], kv[0])):
    if wid in xh or c < MIN_BOOKS:
        continue
    d = words.get(wid)
    if not d or nk(d['w']) in OFFICIAL_KEY:
        continue
    if push(wid, d['w'], '教材/词书共识', 'vote', c, tier=3):
        n3 += 1


# L4 / L5 四六级衔接
def pick(counter, cap, lvname, srcname, minc):
    n = 0

    def fq(wid):
        v = (words.get(wid, {}) or {}).get('freq')
        try:
            return float(v or 0)
        except ValueError:
            return 0.0

    ranked = sorted(counter.items(), key=lambda kv: (fq(kv[0]), -kv[1]), reverse=True)
    for wid, c in ranked:
        if n >= cap or c < minc:
            continue
        d = words.get(wid)
        if not d:
            continue
        k = nk(d['w'])
        if k in OFFICIAL_KEY or k in used:
            continue
        if push(wid, d['w'], lvname, srcname, c, tier=4 if 'CET4' in lvname else 5):
            n += 1
    return n


n4 = pick(cet4_cnt, CET4_CAP, 'CET4 衔接', 'cet4', CET4_MIN)
n5 = pick(cet6_cnt, CET6_CAP, 'CET6 衔接', 'cet6', CET6_MIN)

# L6 高考真题高频688 中词库未收录的派生形
# 必须放在所有层级之后：此时 used 已含全部词库词，push 会自动跳过已存在的，
# 只补真正缺的（exhausted / thoroughly / obesity…），不会覆盖原有更好的层级。
# 传 vid 让 push 优先取 DictionaryData 的音标释义——ECDICT 对这些词偶有专业义项偏差，
# 例如 affordable 首义被给成「[计] 普及型」。
n_gk = 0
for it in GK_ITEMS:
    if push(it.get('vid', ''), it['w'], '高考真题高频', 'gk688', 0, tier=2):
        n_gk += 1
print('L6 真题高频补录 %d 条' % n_gk)

print('L1课标 %d | L2星火新增 %d | L3共识新增 %d | L4四级 %d | L5六级 %d | 合计 %d'
      % (len(official), n2, n3, n4, n5, len(out)))
print('无音标 %d | 无释义 %d' % (sum(1 for x in out if not x['p']), sum(1 for x in out if not x['m'])))

# ---------------- 5. 标记「基础词汇」 ----------------
# 初中词书共识：出现在 JR_MIN 本以上初中教材/词书里的词，判定为初中段基础词
jrd = defaultdict(int)
for x in out:
    jrd[x['jr']] += 1
print('初中命中本数分布（前20档）:', sorted(jrd.items())[:20])
for th in (4, 6, 8, 10, 12, 15, 20):
    print('   初中命中 >= %2d 本：%d 条' % (th, sum(1 for x in out if x['jr'] >= th)))

for x in out:
    # 四种情形判为初中基础词：
    # 1) 出现在 JR_MIN 本以上初中教材/词书里 —— 教材共识
    # 2) 层级就是「课标·基础」—— 教育部课标的义务教育段(初中)词表，属于官方定义。
    #    不能再用词书投票否决一次：教材词表不收虚词，导致 a / in / the / as / at / be / by
    #    这些最基础的词命中本数极低甚至为 0，会被误判成高中词。
    # 3) 极高频（语料库前 100）且仍在 5 本以上初中词书里 —— 捞回 I / an 这类临界词
    # 4) 课标以原形归并的动词变形（be → is/am/are...）
    # 5) 出现在义教课标（2022）三级词汇表里 —— 官方认定的义务教育阶段词汇，直接采信
    x['bs'] = 1 if (x['jr'] >= JR_MIN
                    or x['lv'] == '课标·基础'
                    or (x['jr'] >= 5 and 0 < x['f'] <= 100)
                    or x['w'].lower() in VERB_FORMS
                    or nk(x['w']) in EDU_KEYS) else 0
    # 优先级：基础 0 < 课标 1 < 星火 2 < 共识 3 < CET4 4 < CET6 5
    x['pri'] = 0 if x['bs'] else x['tier']
    # 高考真题高频：2=核心高频688 1=核心扩展110 0=不在该书
    x['gk'] = GK_KEYS.get(nk(x['w']), 0)
print('基础词汇 %d 条（阈值 %d 本初中词书 + 课标义务段兜底）' % (sum(1 for x in out if x['bs']), JR_MIN))
print('  来源构成：课标义务段 %d 条 | 词书共识(jr>=%d) %d 条 | 高频兜底 %d 条'
      % (sum(1 for x in out if x['lv'] == '课标·基础'),
         JR_MIN,
         sum(1 for x in out if x['jr'] >= JR_MIN and x['lv'] != '课标·基础'),
         sum(1 for x in out if x['bs'] and x['jr'] < JR_MIN and x['lv'] != '课标·基础')))
for lv in sorted(set(x['lv'] for x in out)):
    sub = [x for x in out if x['lv'] == lv]
    print('   %-16s 共 %4d 条，其中基础 %4d 条'
          % (lv, len(sub), sum(1 for x in sub if x['bs'])))

# ---------------- 5. 切出「高考核心 3500」 ----------------
# 高考核心 = 课标 + 高考词书层（不含衔接词）
for x in out:
    x['core'] = 1 if x['tier'] in (1, 2) else 0
print('高考核心 %d 条 | 衔接词 %d 条'
      % (sum(1 for x in out if x['core'] == 1), sum(1 for x in out if x['tier'] >= 4)))

# 输出两份：data/ 供其它脚本流转，app/src/data/ 直接喂给 React 项目。
# （旧版的 words.js 已随 legacy/ 归档，不再生成）
BODY = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
for path in ('data/words.json', 'app/src/data/words.json'):
    d = os.path.dirname(path)
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(BODY)
    print('written %s (%.0f KB)' % (path, len(BODY.encode('utf-8')) / 1024))

