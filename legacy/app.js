(function () {
  'use strict';

  var LS = 'wte3500.v1';
  var LS_WORDS = 'wte3500.words';
  var DEFAULT_WORDS = window.WORDS || [];
  var WORDS = DEFAULT_WORDS;

  var state = {
    view: 'home',
    range: 'all',
    order: 'asc',
    seed: 1,
    showPh: true,
    showMean: false,
    speak: false,
    idx: [],          // 当前测试序列：WORDS 的下标数组
    pos: 0,
    ans: {},          // key = WORDS 下标，值: 1 会 / 0 不会
    reveal: false     // 当前卡片是否已揭示释义
  };

  // ---------- 工具 ----------
  var $ = function (id) { return document.getElementById(id); };

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify(state));
    } catch (e) { /* 忽略存储失败 */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          state.range = s.range || 'all';
          state.order = s.order || 'asc';
          state.seed = s.seed || 1;
          state.showPh = s.showPh !== false;
          state.showMean = !!s.showMean;
          state.speak = !!s.speak;
          state.pos = s.pos || 0;
          state.ans = s.ans || {};
          state.idx = Array.isArray(s.idx) ? s.idx : [];
        }
      }
      var cw = localStorage.getItem(LS_WORDS);
      if (cw) {
        var arr = JSON.parse(cw);
        if (Array.isArray(arr) && arr.length) WORDS = arr;
      }
    } catch (e) { }
  }

  function mb32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function setView(v) {
    state.view = v;
    $('viewHome').classList.toggle('hidden', v !== 'home');
    $('viewCard').classList.toggle('hidden', v !== 'card');
    $('viewResult').classList.toggle('hidden', v !== 'result');
    window.scrollTo(0, 0);
    if (v === 'home') renderHome();
    if (v === 'card') renderCard();
    if (v === 'result') renderResult();
    save();
  }

  // ---------- 首页 ----------
  function counts() {
    var ok = 0, no = 0;
    for (var k in state.ans) {
      if (state.ans[k] === 1) ok++; else no++;
    }
    return { ok: ok, no: no, done: ok + no };
  }

  function renderHome() {
    $('totalBadge').textContent = WORDS.length;
    var c = counts();
    $('homeStats').innerHTML =
      stat(c.done, '已标记', '') +
      stat(c.ok, '会', 'g') +
      stat(c.no, '不会', 'r') +
      stat(Math.max(0, WORDS.length - c.done), '未测试', 'y');
    var chip = $('progressChip');
    if (c.done > 0) {
      chip.textContent = '上次进度：已测 ' + c.done + ' / ' + WORDS.length;
      chip.classList.remove('hidden');
    } else {
      chip.classList.add('hidden');
    }
    updateRangeOptions();
    $('optOrder').value = state.order;
    $('optPh').checked = state.showPh;
    $('optMean').checked = state.showMean;
    $('optSpeak').checked = state.speak;
  }

  function updateRangeOptions() {
    var core = 0, cs = 0, bridge = 0, junior = 0;
    for (var i = 0; i < WORDS.length; i++) {
      var lv = WORDS[i].lv || '';
      if (WORDS[i].core === 1) core++;
      if (lv.indexOf('课标') >= 0) cs++;
      if (lv.indexOf('CET') >= 0) bridge++;
      if (WORDS[i].bs) junior++;
    }
    var n = { all: WORDS.length, core: core, cs: cs,
              junior: junior, senior: WORDS.length - junior, bridge: bridge };
    var txt = { all: '全部', core: '高考核心', cs: '仅教育部课标',
                junior: '仅初中基础词汇', senior: '高中及以上（跳过基础）', bridge: '仅四六级衔接' };
    var sel = $('optRange');
    if (!sel) return;
    for (var o = 0; o < sel.options.length; o++) {
      var v = sel.options[o].value;
      if (n[v] !== undefined) sel.options[o].text = txt[v] + ' · ' + n[v] + ' 条';
    }
    sel.value = state.range;
  }

  function stat(n, label, cls) {
    return '<div class="stat ' + (cls || '') + '"><span>' + label + '</span><b>' + n + '</b></div>';
  }

  function baseIdx() {
    var list = [];
    for (var i = 0; i < WORDS.length; i++) {
      var w = WORDS[i], lv = w.lv || '';
      if (state.range === 'core' && w.core !== 1) continue;
      if (state.range === 'cs' && lv.indexOf('课标') < 0) continue;
      if (state.range === 'junior' && !w.bs) continue;
      if (state.range === 'senior' && w.bs) continue;
      if (state.range === 'bridge' && lv.indexOf('CET') < 0) continue;
      list.push(i);
    }
    return list;
  }

  // ---------- 词频 ----------
  // f = 语料库词频排名（1=最常用），缺失时排到最后
  function freqKey(i) {
    var f = WORDS[i].f;
    return f > 0 ? f : 99999;
  }

  // ---------- 优先级 ----------
  // 0 初中基础 → 1 课标 → 2 星火 → 3 教材共识 → 4 CET4 → 5 CET6
  function priKey(i) {
    var p = WORDS[i].pri;
    if (typeof p === 'number') return p;
    return WORDS[i].bs ? 0 : (WORDS[i].tier || 9);
  }

  function priName(i) {
    var p = priKey(i);
    return ['初中基础', '高中·课标', '高中·词书', '高中·共识', 'CET4 衔接', 'CET6 衔接'][p] || '其它';
  }

  function starsHtml(c, onCls, offCls) {
    var on = '', off = '';
    for (var i = 0; i < c; i++) on += '★';
    for (var j = c; j < 5; j++) off += '☆';
    return '<span class="' + onCls + '">' + on + '</span>' +
      '<span class="' + offCls + '">' + off + '</span>';
  }

  function freqTitle(w) {
    var s = [];
    if (w.f) s.push('词频排名 ' + w.f + '/5 万词表');
    if (w.a) s.push('认知率 ' + w.a + '%');
    return s.join(' · ');
  }

  // ---------- 构建测试序列 ----------
  function buildlist(mode, startWord) {
    var all = baseIdx();
    var list;
    if (mode === 'weak') {
      list = all.filter(function (i) { return state.ans[i] === 0; });
      if (!list.length) { toast('没有标记为「不会」的单词'); return false; }
    } else {
      var start = startWord || 1;
      list = all.slice(Math.max(0, start - 1));
    }
    // 优先级：初中基础 → 高中（课标/星火/共识）→ 四六级衔接，同级内再按词频从高到低
    if (state.order === 'pri') {
      list.sort(function (a, b) {
        var d = priKey(a) - priKey(b);
        if (d) return d;
        var f = freqKey(a) - freqKey(b);
        return f ? f : a - b;
      });
    }
    if (state.order === 'freq' || state.order === 'rare') {
      var dir = state.order === 'rare' ? -1 : 1;
      list.sort(function (a, b) {
        var d = freqKey(a) - freqKey(b);
        return (d ? d : a - b) * dir;
      });
    }
    if (state.order === 'random') {
      state.seed = (state.seed * 1664525 + 1013904223) % 4294967296;
      var rnd = mb32(state.seed);
      for (var i = list.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      }
    }
    state.idx = list;
    state.pos = 0;
    return true;
  }

  function updateBar() {
    if (!state.idx.length) return;
    var pct = Math.round(state.pos / state.idx.length * 100);
    $('progressBar').setAttribute('aria-valuenow', String(pct));
  }

  function jumpWeak() {
    for (var i = state.pos + 1; i < state.idx.length; i++) {
      if (state.ans[state.idx[i]] !== 1) {
        state.pos = i;
        renderCard(); save();
        toast('跳到第 ' + (i + 1) + ' 个');
        return;
      }
    }
    toast('后面没有待巩固的词了');
  }

  // ---------- 卡片 ----------
  function renderCard() {
    if (!state.idx.length) { setView('home'); return; }
    if (state.pos >= state.idx.length) { setView('result'); return; }

    var wi = state.idx[state.pos];
    var w = WORDS[wi];
    if (!w) { state.pos++; renderCard(); return; }

    $('counter').textContent = (state.pos + 1) + ' / ' + state.idx.length;
    var c = counts();
    $('cntOk').textContent = c.ok;
    $('cntNo').textContent = c.no;
    $('progressIn').style.width = ((state.pos) / state.idx.length * 100) + '%';
    updateBar();

    $('wordText').textContent = w.w;
    $('wordPh').textContent = state.showPh ? (w.p || '') : '';
    $('wordPh').classList.toggle('hidden', !state.showPh || !w.p);

    state.reveal = state.showMean;
    applyReveal(w);

    if (state.speak) speakWord(w.w);

    // 层级徽章（教育部课标 / 高考词书 / 衔接）
    // 基础词若层级本身就是「课标·基础」，就不再重复挂层级标签——"初中基础"已表达同一件事
    var lvText = w.lv ? (w.lv + (w.xh ? ' · 星火' : '')) : '';
    var lvDup = w.bs && w.lv === '课标·基础';
    $('lvTag').textContent = lvDup ? '' : lvText;
    $('lvTag').classList.toggle('hidden', !lvText || lvDup);

    // 初中基础词汇徽章
    var bt = $('baseTag');
    bt.classList.toggle('hidden', !w.bs);
    // 只说事实，不猜来源：判定可能是课标义务段、也可能是初中词书共识
    bt.title = w.bs
      ? '初中段基础词' + (w.jr > 0 ? '（' + w.jr + ' 本初中教材/词书收录）' : '（教育部课标义务教育段要求）')
      : '';

    // 常用度星级（柯林斯 1-5 星；颜色之外还有 5 档形状，不单靠颜色传达）
    var ft = $('freqTag');
    if (w.c > 0) {
      ft.innerHTML = '<span aria-hidden="true">' + starsHtml(w.c, 'on', 'off') + '</span>' +
        '<span class="sr">常用度 ' + w.c + '/5' + (w.f ? '，词频排名 ' + w.f : '') +
        (w.a ? '，认知率 ' + w.a + '%' : '') + '</span>';
      ft.title = freqTitle(w);
      ft.classList.remove('hidden');
    } else {
      ft.textContent = '';
      ft.title = '';
      ft.classList.add('hidden');
    }

    // 上次标记状态（不依赖颜色单独传达，附带文字）
    var prevAns = state.ans[wi];
    var tag = $('lastTag');
    if (prevAns === 1) {
      tag.className = 'pill ok';
      tag.textContent = '上次标记：会 ✓';
    } else if (prevAns === 0) {
      tag.className = 'pill no';
      tag.textContent = '上次标记：不会 ✗';
    } else {
      tag.className = 'pill hidden';
    }
    updateBar();
  }

  function applyReveal(w) {
    var m = $('wordMean');
    if (state.reveal && w.m) {
      m.textContent = w.m;
      m.classList.remove('hidden');
    } else {
      m.classList.add('hidden');
    }
    $('wordHint').classList.toggle('hidden', state.reveal);
  }

  function toggleMean() {
    var wi = state.idx[state.pos];
    var w = WORDS[wi];
    state.reveal = !state.reveal;
    applyReveal(w || {});
  }

  function speakWord(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { }
  }

  function answer(ok) {
    if (state.view !== 'card' || !state.idx.length) return;
    var wi = state.idx[state.pos];
    state.ans[wi] = ok ? 1 : 0;
    if (state.speak) speakWord(WORDS[wi].w);
    state.pos++;
    if (state.pos >= state.idx.length) { save(); setView('result'); return; }
    renderCard();
    save();
  }

  function undo() {
    if (state.view !== 'card') return;
    if (state.pos === 0) { toast('已经在第一个了'); return; }
    state.pos--;
    delete state.ans[state.idx[state.pos]];
    renderCard();
    save();
  }

  function prevWord() {
    if (state.pos === 0) { toast('已经在第一个了'); return; }
    state.pos--;
    renderCard();
    save();
  }

  function skipWord() {
    state.pos++;
    if (state.pos >= state.idx.length) { save(); setView('result'); return; }
    renderCard();
    save();
  }

  // ---------- 结果 ----------
  function renderResult() {
    var c = counts();
    var total = WORDS.length;
    var rate = c.done ? Math.round(c.ok / c.done * 100) : 0;
    $('resStats').innerHTML =
      stat(total, '词库总数', '') +
      stat(c.done, '已测试', '') +
      stat(c.ok, '会', 'g') +
      stat(c.no, '不会', 'r') +
      stat(total - c.done, '未测试', 'y');
    $('rateText').textContent = rate + '%';
    $('ringFg').style.strokeDashoffset = 327 * (1 - rate / 100);
    $('verdict').innerHTML = verdictText(rate, c) + freqVerdict() + baseVerdict();
    renderList();
  }

  // 词频视角：不会的词里有多少是高频词，并点名最该先攻的那几个
  function freqVerdict() {
    var weak = [];
    for (var i = 0; i < WORDS.length; i++) {
      if (state.ans[i] === 0) weak.push(WORDS[i]);
    }
    if (!weak.length) return '';
    var high = weak.filter(function (w) { return w.c >= 4; });
    if (!high.length) {
      return '<br>好消息：高频词（4-5 星）你全都会了，剩下的都是低频词。';
    }
    var pct = Math.round(high.length / weak.length * 100);
    var top = high.slice().sort(function (a, b) {
      return (a.f || 99999) - (b.f || 99999);
    }).slice(0, 5).map(function (w) { return '<b>' + esc(w.w) + '</b>'; });
    return '<br>不会的词里 <b>' + high.length + '</b> 个是高频词（4-5 星，占 ' + pct +
      '%），最该先拿下：' + top.join('、') + '。';
  }

  // 基础段视角：不会的词里混进多少初中词，直接反映底子有没有缺口
  function baseVerdict() {
    var weak = [];
    for (var i = 0; i < WORDS.length; i++) {
      if (state.ans[i] === 0) weak.push(WORDS[i]);
    }
    if (!weak.length) return '';
    var bs = weak.filter(function (w) { return w.bs; });
    if (!bs.length) {
      return '<br>生词全部集中在高中及以上，<b>初中基础段没有缺口</b>。';
    }
    var pct = Math.round(bs.length / weak.length * 100);
    return '<br>生词里 <b>' + bs.length + '</b> 个属于初中基础词（占 ' + pct + '%）' +
      (pct >= 30 ? '，基础段有缺口，建议先用「仅初中基础词汇」过一轮。' : '，基础段基本扎实。');
  }

  function verdictText(rate, c) {
    if (!c.done) return '还没开始测试，先过一轮看看真实水平。';
    var left = c.no;
    var s;
    if (rate >= 90) s = '掌握得很稳，剩下的 <b>' + left + '</b> 个是硬骨头，集中攻克就行。';
    else if (rate >= 70) s = '底子不错，优先把 <b>' + left + '</b> 个生词刷熟。';
    else if (rate >= 45) s = '一半上下，建议用「重测不会的词」再连过两轮。';
    else s = '别慌，先把最短、最常见的那批拿下，再回头扫 <b>' + left + '</b> 个生词。';
    return s + '<br>已过 <b>' + c.done + '</b> 词，' + (left ? '待巩固 <b>' + left + '</b> 词。' : '暂无生词。');
  }

  function renderList() {
    var mode = $('filterStatus').value;
    var lvl = $('filterLevel').value;
    var fr = $('filterFreq').value;
    var q = ($('filterText').value || '').trim().toLowerCase();
    var base = state.idx.length ? state.idx : WORDS.map(function (_, i) { return i; });
    if (mode === 'all') base = WORDS.map(function (_, i) { return i; });

    var rows = [];
    for (var n = 0; n < base.length; n++) {
      var i = base[n];
      var w = WORDS[i];
      if (!w) continue;
      var a = state.ans[i];
      var st = a === 1 ? 'ok' : (a === 0 ? 'no' : 'none');
      if (mode === 'no' && st !== 'no') continue;
      if (mode === 'ok' && st !== 'ok') continue;
      if (mode === 'skip' && st !== 'none') continue;
      if (lvl === '__base' && !w.bs) continue;
      if (lvl === '__senior' && w.bs) continue;
      if (lvl && lvl.indexOf('__') !== 0 && (w.lv || '').indexOf(lvl) < 0) continue;
      if (q && w.w.toLowerCase().indexOf(q) < 0 && (w.m || '').toLowerCase().indexOf(q) < 0) continue;
      if (fr === 'high' && w.c < 4) continue;
      if (fr === 'mid' && w.c !== 3) continue;
      if (fr === 'low' && (w.c < 1 || w.c > 2)) continue;
      if (fr === 'none' && w.c > 0) continue;
      rows.push('<div class="item"><span class="w">' + esc(w.w) + '</span>' +
        '<span class="fr"' + (w.c ? ' title="' + esc(freqTitle(w)) + '"' : '') + '>' +
        (w.c ? '<span aria-hidden="true">' + starsHtml(w.c, 'on', 'off') + '</span>' +
          '<span class="sr">常用度 ' + w.c + '/5</span>' : '') + '</span>' +
        '<span class="p">' + esc(w.p || '') + '</span>' +
        '<span class="m">' + esc(w.m || '') + '</span>' +
        (w.bs ? '<span class="tag base">初中基础</span>'
              : (w.lv ? '<span class="tag none">' + esc(w.lv) + '</span>' : '')) +
        '<span class="tag ' + st + '">' + (st === 'ok' ? '会' : st === 'no' ? '不会' : '未标记') + '</span></div>');
    }
    $('list').innerHTML = rows.length ? rows.join('') : '<div class="item"><span class="m">没有匹配的条目</span></div>';
    $('listTip').textContent = '共 ' + rows.length + ' 条（当前列表范围：' +
      (mode === 'all' ? '全部词库' : state.idx.length ? '本次测试序列' : '本次测试序列') + '，共 ' + base.length + ' 词）';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  // ---------- 导出 ----------
  function dateStr() {
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function download(content, filename, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    toast('已导出：' + filename);
  }

  function csvCell(s) {
    s = String(s == null ? '' : s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function rowsFor(onlyWeak) {
    var out = [];
    for (var i = 0; i < WORDS.length; i++) {
      var a = state.ans[i];
      if (a === undefined) continue;
      if (onlyWeak && a !== 0) continue;
      out.push({ word: WORDS[i].w, ph: WORDS[i].p || '', mean: WORDS[i].m || '',
                 lv: WORDS[i].lv || '', st: a === 1 ? '会' : '不会',
                 frq: WORDS[i].f || '', star: WORDS[i].c || '', ack: WORDS[i].a || '',
                 bs: WORDS[i].bs ? '是' : '', jr: WORDS[i].jr || '' });
    }
    return out;
  }

  function exportCsv(onlyWeak) {
    var rows = rowsFor(onlyWeak);
    if (!rows.length) { toast('没有可导出的内容'); return; }
    // 生词本按常用度从高到低排，先背最该背的
    if (onlyWeak) {
      rows.sort(function (a, b) {
        return (a.frq || 99999) - (b.frq || 99999);
      });
    }
    var head = onlyWeak
      ? '单词,音标,释义,常用度(1-5星),词频排名,认知率%,初中基础词,层级\n'
      : '单词,音标,释义,常用度(1-5星),词频排名,认知率%,初中基础词,层级,状态\n';
    var body = rows.map(function (r) {
      var base = [csvCell(r.word), csvCell(r.ph), csvCell(r.mean),
        csvCell(r.star), csvCell(r.frq), csvCell(r.ack),
        csvCell(r.bs), csvCell(r.lv)];
      if (!onlyWeak) base.push(csvCell(r.st));
      return base.join(',');
    }).join('\n');
    download('\ufeff' + head + body,
      (onlyWeak ? '生词-不会-' : '单词测试结果-') + dateStr() + '.csv',
      'text/csv;charset=utf-8');
  }

  // ---------- PDF（走浏览器打印 / 另存为 PDF） ----------
  function exportPdf(mode) {
    var rows = rowsFor(true);
    if (!rows.length) { toast('还没有标记为「不会」的单词'); return; }
    $('printArea').innerHTML = buildDoc(rows, mode);
    toast('已生成 ' + rows.length + ' 词的 PDF，在打印窗口选择「另存为 PDF」');
    setTimeout(function () { window.print(); }, 120);
  }

  function nowStr() {
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function buildDoc(rows, mode) {
    var quiz = mode === 'quiz';
    var c = counts();
    var nb = 0;
    for (var k = 0; k < rows.length; k++) { if (rows[k].bs === '是') nb++; }
    var head =
      '<header class="doc-head"><div>' +
      '<h1>' + (quiz ? '生词默写本' : '生词本') + '</h1>' +
      '<p class="sub">' + (quiz ? '先看单词回想释义，答案见末页' : '未掌握单词 · 含音标与释义') + '</p>' +
      '</div><div class="meta"><b>' + rows.length + '</b>个词' +
      (nb ? ' · 含初中基础 ' + nb + ' 个' : '') +
      '<br>生成于 ' + esc(nowStr()) + '</div></header>';

    // 每行排 2 个词：左右各 4 列（# / 单词 / 音标 / 释义）
    function cells(r, no) {
      return '<td class="c-no">' + esc(no) + '</td>' +
        '<td class="c-w">' + esc(r.word) + '</td>' +
        '<td class="c-p">' + esc(r.ph) + '</td>' +
        '<td class="' + (quiz ? 'c-blank' : 'c-m') + '">' + (quiz ? '' : esc(r.mean)) + '</td>';
    }
    var mh = quiz ? '默写（中文释义）' : '释义';
    var half = '<th class="c-no">#</th><th class="c-w">单词</th><th class="c-p">音标</th>' +
      '<th class="c-m">' + mh + '</th>';
    var blank = '<td class="c-no"></td><td class="c-w"></td><td class="c-p"></td><td class="c-m"></td>';

    var body = '<table><thead><tr>' + half + half + '</tr></thead><tbody>';
    for (var i = 0; i < rows.length; i += 2) {
      body += '<tr>' + cells(rows[i], i + 1);
      body += rows[i + 1] ? cells(rows[i + 1], i + 2) : blank;
      body += '</tr>';
    }
    body += '</tbody></table>';

    var ans = '';
    if (quiz) {
      ans = '<section class="answers"><h2>答案</h2><div class="ans-col">';
      for (var j = 0; j < rows.length; j++) {
        ans += '<div><b>' + (j + 1) + '. ' + esc(rows[j].word) + '</b> <span>' + esc(rows[j].mean) + '</span></div>';
      }
      ans += '</div></section>';
    }

    var rate = c.done ? Math.round(c.ok / c.done * 100) : 0;
    var foot = '<footer class="doc-foot"><span>由「单词自测」生成 · 词库：教育部课标（2025 修订）+ 星火高考词汇</span>' +
      '<span>已测 ' + c.done + ' 词 · 掌握率 ' + rate + '%</span></footer>';

    return head + body + ans + foot;
  }

  function exportTxt() {
    var rows = rowsFor(true);
    if (!rows.length) { toast('没有「不会」的单词'); return; }
    download(rows.map(function (r) { return r.word; }).join('\n'),
      '生词-不会-' + dateStr() + '.txt');
  }

  function copyWeak() {
    var rows = rowsFor(true);
    if (!rows.length) { toast('没有「不会」的单词'); return; }
    var text = rows.map(function (r) { return r.word; }).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制 ' + rows.length + ' 个单词到剪贴板');
      }, function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); }
    catch (e) { toast('复制失败，请手动导出'); }
    ta.remove();
  }

  // ---------- 导入 ----------
  function parseImport(text) {
    var lines = text.split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf(',') > 0 && /\t/.test(line) === false && /^[A-Za-z][A-Za-z\-' ]*,/.test(line)) {
        var c = line.split(',');
        out.push({ w: c[0].trim(), p: '', m: c.slice(1).join(',').trim() });
        continue;
      }
      var parts = line.split(/\t|,|\s{2,}/);
      var w = (parts[0] || '').trim();
      if (!w) continue;
      out.push({ w: w, p: '', m: (parts[1] || '').trim() });
    }
    return out;
  }

  function applyImport(list, msg) {
    if (!list.length) { toast('没解析到任何单词'); return; }
    WORDS = list;
    localStorage.setItem(LS_WORDS, JSON.stringify(list));
    state.ans = {}; state.idx = []; state.pos = 0;
    save();
    setView('home');
    toast((msg || '已导入') + ' ' + list.length + ' 条');
  }

  // ---------- 事件 ----------
  function bind() {
    $('btnNew').onclick = function () {
      state.range = $('optRange').value;
      state.order = $('optOrder').value;
      state.showPh = $('optPh').checked;
      state.showMean = $('optMean').checked;
      state.speak = $('optSpeak').checked;
      if (!buildlist('normal', parseInt($('optStart').value, 10) || 1)) return;
      setView('card');
    };
    $('btnResume').onclick = function () {
      if (!state.idx.length) {
        state.order = $('optOrder').value;
        if (!buildlist('normal', 1)) return;
      }
      setView('card');
    };
    $('btnWeak').onclick = function () {
      if (!buildlist('weak')) { setView('home'); return; }
      setView('card');
    };
    $('btnResetAll').onclick = function () {
      if (!confirm('确认清空所有标记和进度？词库不受影响。')) return;
      state.ans = {}; state.pos = 0; state.idx = [];
      save(); renderHome(); toast('已重置');
    };

    $('btnOk').onclick = function () { answer(true); };
    $('btnNo').onclick = function () { answer(false); };
    $('btnSpeak').onclick = function () { if (WORDS[state.idx[state.pos]]) speakWord(WORDS[state.idx[state.pos]].w); };
    $('btnMean').onclick = toggleMean;
    $('btnUndo').onclick = undo;
    $('btnPrev').onclick = prevWord;
    $('btnPass').onclick = skipWord;
    $('btnFinish').onclick = function () { setView('result'); };
    $('btnJumpWeak').onclick = jumpWeak;

    $('expNoCsv').onclick = function () { exportCsv(true); };
    $('expAllCsv').onclick = function () { exportCsv(false); };
    $('expNoTxt').onclick = exportTxt;
    $('expNoPdf').onclick = function () { exportPdf('learn'); };
    $('expNoPdfQuiz').onclick = function () { exportPdf('quiz'); };
    $('expCopy').onclick = copyWeak;
    $('btnBack').onclick = function () { if (!state.idx.length) { buildlist('normal', 1); } setView('card'); };
    $('btnRetestWeak').onclick = function () {
      if (!buildlist('weak')) { toast('没有标记为「不会」的单词'); return; }
      setView('card');
    };
    $('btnHome').onclick = function () { setView('home'); };

    $('filterStatus').onchange = renderList;
    $('filterLevel').onchange = renderList;
    $('filterFreq').onchange = renderList;
    $('filterText').oninput = function () {
      clearTimeout($('filterText')._t);
      $('filterText')._t = setTimeout(renderList, 120);
    };

    $('btnImport').onclick = function () {
      var list = parseImport($('importText').value);
      applyImport(list, '导入成功');
    };
    $('btnRestore').onclick = function () {
      WORDS = DEFAULT_WORDS;
      localStorage.removeItem(LS_WORDS);
      state.ans = {}; state.idx = []; state.pos = 0;
      save(); setView('home'); toast('已恢复默认词库 ' + WORDS.length + ' 条');
    };
    $('fileInput').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        applyImport(parseImport(String(fr.result || '')), '导入成功');
      };
      fr.readAsText(f, 'utf-8');
      e.target.value = '';
    };

    document.addEventListener('keydown', onKey);

    // ---------- 卡片：点按看释义 + 左右滑动标记 ----------
    // 原本「看释义」只有 S 键、没有任何按钮，手机上完全够不着；滑动标记也补上。
    (function bindStage() {
      var stage = document.querySelector('#viewCard .stage');
      if (!stage) return;
      var sx = 0, sy = 0, tracking = false, swiped = false, busy = false;
      var TH = 46;                       // 水平滑动判定阈值(px)

      stage.addEventListener('click', function () {
        if (busy) return;
        if (swiped) { swiped = false; return; }   // 吞掉滑动后浏览器补发的 click
        if (state.view !== 'card') return;
        toggleMean();
      });

      stage.addEventListener('touchstart', function (e) {
        if (busy || e.touches.length !== 1 || state.view !== 'card') return;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        tracking = true;
        swiped = false;
      }, { passive: true });

      stage.addEventListener('touchmove', function (e) {
        if (!tracking || e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - sx;
        var dy = e.touches[0].clientY - sy;
        // 横向意图明确时阻止纵向滚动，否则滑到一半页面会跟着滚
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) && e.cancelable) {
          e.preventDefault();
        }
      }, { passive: false });

      stage.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - sx, dy = t.clientY - sy;
        // 位移不够、或纵向分量过大 → 当成点按，交给 click 处理
        if (Math.abs(dx) < TH || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        swiped = true;
        busy = true;
        stage.classList.add(dx > 0 ? 'swipe-r' : 'swipe-l');
        setTimeout(function () {
          stage.classList.remove('swipe-r', 'swipe-l');
          answer(dx > 0);
          busy = false;
        }, 160);
      }, { passive: true });
    })();

    // 防止按钮获得焦点后空格重复触发
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b) b.blur();
    });
  }

  function onKey(e) {
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') {
      if (state.view === 'card') setView('result');
      else if (state.view === 'result') setView('card');
      return;
    }

    var k = (e.key || '').toLowerCase();

    // ---------- 结果页 ----------
    if (state.view === 'result') {
      if (e.key === '/') {                       // GitHub 式：斜杠聚焦搜索
        e.preventDefault();
        $('filterText').focus();
      } else if (k === 'b') {                    // Back：继续测试
        e.preventDefault();
        if (!state.idx.length) buildlist('normal', 1);
        setView('card');
      } else if (k === 'r') {                    // Retest：重测不会的词
        e.preventDefault();
        $('btnRetestWeak').click();
      } else if (k === 'h') {                    // Home
        e.preventDefault();
        setView('home');
      }
      return;
    }

    // ---------- 首页 ----------
    if (state.view === 'home') {
      if (e.key === 'Enter') {                   // 回车直接开测
        e.preventDefault();
        $('btnNew').click();
      }
      return;
    }

    if (state.view !== 'card') return;

    // ---------- 答题页 ----------
    if (e.key === ' ' || e.key === 'ArrowRight' || k === 'y' || k === '1' || e.key === 'Enter') {
      e.preventDefault(); answer(true);
    } else if (e.key === 'ArrowLeft' || k === 'n' || k === '2') {
      e.preventDefault(); answer(false);
    } else if (k === 's' || e.key === 'ArrowDown') {
      e.preventDefault(); toggleMean();
    } else if (k === 'p') {
      e.preventDefault();
      var w = WORDS[state.idx[state.pos]];
      if (w) speakWord(w.w);
    } else if (k === 'u' || e.key === 'Backspace') {
      e.preventDefault(); undo();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); prevWord();
    } else if (k === 'x') {
      e.preventDefault(); skipWord();
    } else if (k === 'w') {
      e.preventDefault(); jumpWeak();
    }
  }

  // ---------- 启动 ----------
  load();
  bind();
  setView('home');
})();
