/* 会見録チェッカー：画面 */
(function () {
  const R = window.KaikenRules;
  const C = window.KaikenChecker;
  const $ = (id) => document.getElementById(id);

  const SAMPLE = [
    '令和8年10月20日　定例記者会見',
    '【幹事社】',
    'それでは、幹事社から質問させていただきます。今回の発表について、知事の受け止めをお聞かせください。',
    '知事',
    'はい。では、まず一つ目の発表です。今回、九州山口の各県と連携して、観光のまち作りを進める中で、県産ワインをブルゴーニュのような地域ブランドとして育てていきたいと考えています。',
    '実際、昨年の時は来場者数が伸び悩んでいたんで、これによって、もう一度魅力を発信していくということです。',
    '既に一人一人の生産者の方々からも、どんどんどんどん声が上がっていて、そういった形を目がけて、新しい仕組みを作るということを、是非受け止めていただければと思います。',
    'いわゆるインバウンドとか、若い世代とか、そういう方々にも分かるような形で、、情報を届けていくっていうことが大事だと思っています。',
    'なお、九州・山口の「ブルゴーニュ」と呼ばれる産地の皆さんとは、期間中に意見が分かれる点も含めて協議します。',
    'また、熊本心のケアセンターと連携し、熊本こころのケアセンターの相談窓口も周知していきます。',
    'では、私からは以上です。',
  ];

  // ── 保存（使えない環境でも動くように）──
  const store = {
    get(k, d) { try { const v = localStorage.getItem('kaiken:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kaiken:' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても続行 */ } },
  };

  const state = {
    name: 'サンプル原稿',
    sample: true,
    paragraphs: SAMPLE,
    mode: store.get('mode', 'teirei'),
    detected: null,
    terms: store.get('terms', R.DEFAULT_TERMS.join('\n')),
    userRules: store.get('userRules', ''),
    exclusions: store.get('exclusions', ''),
    monthly: typeof window.KaikenMonthly === 'string' ? window.KaikenMonthly : null,
    issues: [],
    status: {},              // id -> 'done' | 'skip'
    hidden: new Set(),       // 非表示の分類
    onlyOpen: false,
    active: null,
    size: store.get('size', 17),
    theme: store.get('theme', 'system'),
  };

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('コピーしました'); return; } catch (e) { /* 下で代替 */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? 'コピーしました' : 'コピーできませんでした。手動で選択してください');
  }

  // ── チェック ──
  function run() {
    state.issues = C.check(state.paragraphs, {
      mode: state.mode,
      terms: C.parseList(state.terms),
      userRules: state.userRules,
      exclusions: C.parseList(state.exclusions),
      monthly: state.monthly || '',
    });
    state.status = {};
    state.active = null;
    render();
  }

  const visible = (it) => !state.hidden.has(it.cat) && (!state.onlyOpen || !state.status[it.id]);

  function render() {
    renderHeader();
    renderDoc();
    renderChips();
    renderList();
  }

  function renderHeader() {
    $('doc-name').textContent = state.name;
    $('doc-tag').hidden = !state.sample;
    document.querySelectorAll('#mode-seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    const m = R.MODES[state.mode];
    $('mode-hint').textContent = `${m.label}：${m.hint}` + (state.detected ? '（本文から判定）' : '');
    const chars = state.paragraphs.reduce((n, p) => n + p.length, 0);
    $('doc-stats').textContent = `${state.paragraphs.length} 段落 ・ ${chars.toLocaleString()} 字`;
    $('monthly-badge').textContent = state.monthly === null ? '今月の用語：読み込めません' : `今月の用語：${monthlyTerms().length}語`;
    document.documentElement.style.setProperty('--doc-size', state.size + 'px');
    const themeLabel = { system: '自動', light: 'ライト', dark: 'ダーク' }[state.theme];
    $('theme-toggle').textContent = 'テーマ：' + themeLabel;
    if (state.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
  }

  function renderDoc() {
    const byP = new Map();
    for (const it of state.issues) {
      if (state.hidden.has(it.cat)) continue;
      if (!byP.has(it.p)) byP.set(it.p, []);
      byP.get(it.p).push(it);
    }
    const html = state.paragraphs.map((text, p) => {
      const list = byP.get(p) || [];
      let body = '';
      if (!list.length) body = esc(text);
      else {
        const cuts = new Set([0, text.length]);
        list.forEach((it) => { cuts.add(it.start); cuts.add(it.end); });
        const pts = [...cuts].sort((a, b) => a - b);
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const seg = esc(text.slice(a, b));
          const on = list.filter((it) => it.start <= a && it.end >= b);
          if (!on.length) { body += seg; continue; }
          const done = on.every((it) => state.status[it.id]);
          const cls = ['m', 'cat-' + on[0].cat, on.length > 1 ? 'is-multi' : '', done ? 'is-done' : ''].join(' ');
          const title = on.map((it) => `${R.CATS[it.cat].label}：${it.text} → ${it.suggest || '（削除）'}`).join('\n');
          body += `<mark class="${cls}" data-ids="${on.map((it) => it.id).join(',')}" title="${esc(title)}">${seg}</mark>`;
        }
      }
      return `<p class="para" data-p="${p}"><span class="pno">${p + 1}</span><span class="ptext">${body}</span></p>`;
    }).join('');
    $('doc').innerHTML = html;
  }

  function renderChips() {
    const counts = {};
    state.issues.forEach((it) => { counts[it.cat] = (counts[it.cat] || 0) + 1; });
    $('chips').innerHTML = Object.keys(R.CATS).filter((c) => counts[c]).map((c) =>
      `<button type="button" class="chip cat-${c}" data-cat="${c}" aria-pressed="${!state.hidden.has(c)}">${R.CATS[c].label} ${counts[c]}</button>`
    ).join('');
  }

  function context(it) {
    const text = state.paragraphs[it.p];
    const a = Math.max(0, it.start - 14), b = Math.min(text.length, it.end + 14);
    return (a > 0 ? '…' : '') + esc(text.slice(a, it.start)) + '<b>' + esc(it.text) + '</b>' + esc(text.slice(it.end, b)) + (b < text.length ? '…' : '');
  }

  function renderList() {
    const total = state.issues.length;
    const open = state.issues.filter((it) => !state.status[it.id]).length;
    $('count-total').textContent = total;
    $('count-open').textContent = total ? `未確認 ${open} ／ 確認済み・対象外 ${total - open}` : '';
    const items = state.issues.filter(visible);
    if (!items.length) {
      $('items').innerHTML = `<li class="empty">${total ? '表示する指摘はありません。絞り込みを外してください。' : '指摘はありません。表記メモに沿っています。'}</li>`;
      return;
    }
    $('items').innerHTML = items.map((it) => {
      const st = state.status[it.id];
      const to = it.suggest ? `<span class="to">${esc(it.suggest)}</span>` : '<span class="to del">（削除）</span>';
      return `<li class="item cat-${it.cat}${st ? ' is-' + st : ''}${state.active === it.id ? ' is-active' : ''}" data-id="${it.id}" tabindex="0">
        <div class="item-head"><span class="pill">${R.CATS[it.cat].label}</span><span class="loc">段落 ${it.p + 1}</span>${it.check ? '<span class="flag">要確認</span>' : ''}<span class="state">${st === 'done' ? '確認済み' : st === 'skip' ? '対象外' : ''}</span></div>
        <div class="change"><span class="from">${esc(it.text)}</span><span class="arrow">→</span>${to}</div>
        <div class="ctx">${context(it)}</div>
        <div class="note">${esc(it.note || '')}</div>
        <div class="actions">
          <button type="button" class="btn" data-act="done" aria-pressed="${st === 'done'}">確認済み</button>
          <button type="button" class="btn" data-act="skip" aria-pressed="${st === 'skip'}">対象外</button>
          ${it.suggest ? '<button type="button" class="btn" data-act="copy">候補をコピー</button>' : ''}
        </div>
      </li>`;
    }).join('');
  }

  // ── 選択と移動 ──
  function select(id, from) {
    state.active = id;
    document.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
    const card = document.querySelector(`.item[data-id="${id}"]`);
    if (card) {
      card.classList.add('is-active');
      if (from !== 'list') card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const marks = [...document.querySelectorAll('mark.m')].filter((m) => m.dataset.ids.split(',').includes(String(id)));
    marks.forEach((m) => m.classList.add('is-active'));
    if (marks[0] && from !== 'doc') marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function step(dir) {
    const ids = state.issues.filter(visible).map((it) => it.id);
    if (!ids.length) return;
    const i = ids.indexOf(state.active);
    const next = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length;
    select(ids[next]);
  }

  function setStatus(id, st) {
    state.status[id] = state.status[id] === st ? undefined : st;
    if (!state.status[id]) delete state.status[id];
    const keep = state.active;
    renderDoc(); renderList();
    if (keep !== null) select(keep, 'list');
  }

  // ── 読み込み ──
  function load(name, raw) {
    state.name = name;
    state.sample = false;
    state.paragraphs = C.toParagraphs(raw);
    state.detected = C.detectMode(state.paragraphs);
    if (state.detected) state.mode = state.detected;
    run();
    $('doc-scroll').scrollTop = 0;
    $('items').scrollTop = 0;
    toast(`${state.paragraphs.length} 段落を読み込みました`);
  }

  async function openFile(file) {
    if (!file) return;
    const name = file.name || '原稿';
    try {
      if (/\.docx$/i.test(name)) {
        if (!window.mammoth) throw new Error('Word読み込み用のライブラリが見つかりません（vendor/mammoth.browser.min.js）');
        const res = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        load(name, res.value);
      } else if (/\.doc$/i.test(name)) {
        toast('旧形式（.doc）は読めません。Wordで「.docx」として保存し直してください');
      } else {
        load(name, await file.text());
      }
    } catch (e) {
      toast('読み込めませんでした：' + e.message);
    }
  }

  // ── シート ──
  function openSheet(id) { $(id).hidden = false; const f = $(id).querySelector('textarea'); if (f) f.focus(); }
  function closeSheets() { document.querySelectorAll('.sheet-wrap').forEach((s) => { s.hidden = true; }); }

  function renderRuleTable() {
    $('rule-rows').innerHTML = R.RULES.map((r) => {
      const to = typeof r.to === 'function' ? '一つ目 など' : (r.to === '' ? '（削除）' : r.to.replace(/\$\d/g, '〜'));
      const mode = r.mode ? `［${R.MODES[r.mode].label}］` : '';
      return `<tr class="cat-${r.cat}"><td>${R.CATS[r.cat].label}</td><td>${esc(r.from)}</td><td>${esc(to)}</td><td>${esc(mode + r.note)}${r.check ? '（要確認）' : ''}</td></tr>`;
    }).join('');
  }

  function monthlyTerms() {
    if (state.monthly === null) return [];
    const { rules, terms } = C.monthlyRules(state.monthly);
    const out = [...new Set(terms)];
    rules.forEach((r) => { if (r.from !== r.to && !out.includes(r.from + ' → ' + r.to)) out.push(r.from + ' → ' + r.to); });
    return out;
  }

  function renderMonthly() {
    const list = monthlyTerms();
    $('monthly-warn').hidden = state.monthly !== null;
    $('monthly-count').textContent = state.monthly === null ? '' : `${list.length}語`;
    $('monthly-list').innerHTML = list.map((t) => `<li>${esc(t)}</li>`).join('');
  }

  function openRules() {
    $('terms-text').value = state.terms; $('user-text').value = state.userRules; $('excl-text').value = state.exclusions;
    $('rules-saved').hidden = true;
    renderMonthly();
    openSheet('rules-sheet');
  }

  // ── イベント ──
  $('file-input').addEventListener('change', (e) => { openFile(e.target.files[0]); e.target.value = ''; });

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragDepth++; $('drop').hidden = false; } });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop').hidden = true; });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('drop').hidden = true; openFile(e.dataTransfer.files[0]); });

  $('mode-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    state.mode = b.dataset.mode; state.detected = null;
    store.set('mode', state.mode);
    run();
  });

  $('size-down').addEventListener('click', () => { state.size = Math.max(13, state.size - 1); store.set('size', state.size); renderHeader(); });
  $('size-up').addEventListener('click', () => { state.size = Math.min(26, state.size + 1); store.set('size', state.size); renderHeader(); });
  $('theme-toggle').addEventListener('click', () => {
    state.theme = { system: 'light', light: 'dark', dark: 'system' }[state.theme];
    store.set('theme', state.theme); renderHeader();
  });

  $('paste-open').addEventListener('click', () => openSheet('paste-sheet'));
  $('paste-run').addEventListener('click', () => {
    const v = $('paste-text').value;
    if (!v.trim()) { toast('本文を貼り付けてください'); return; }
    closeSheets(); load('貼り付けたテキスト', v);
  });

  $('rules-open').addEventListener('click', openRules);
  $('monthly-badge').addEventListener('click', openRules);
  $('rules-save').addEventListener('click', () => {
    state.terms = $('terms-text').value; state.userRules = $('user-text').value; state.exclusions = $('excl-text').value;
    store.set('terms', state.terms); store.set('userRules', state.userRules); store.set('exclusions', state.exclusions);
    run();
    $('rules-saved').hidden = false;
  });
  document.querySelectorAll('.sheet-wrap').forEach((w) => w.addEventListener('click', (e) => {
    if (e.target === w || e.target.closest('[data-close]')) closeSheets();
  }));

  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const c = b.dataset.cat;
    state.hidden.has(c) ? state.hidden.delete(c) : state.hidden.add(c);
    renderDoc(); renderChips(); renderList();
  });
  $('only-open').addEventListener('change', (e) => { state.onlyOpen = e.target.checked; renderList(); });

  $('items').addEventListener('click', (e) => {
    const card = e.target.closest('.item');
    if (!card) return;
    const id = +card.dataset.id;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'copy') { copyText(state.issues[id].suggest); return; }
    if (act === 'done' || act === 'skip') { setStatus(id, act); return; }
    select(id, 'list');
  });
  $('items').addEventListener('keydown', (e) => {
    const card = e.target.closest('.item');
    if (card && e.key === 'Enter' && e.target === card) select(+card.dataset.id, 'list');
  });
  $('doc').addEventListener('click', (e) => {
    const m = e.target.closest('mark.m');
    if (!m) return;
    const ids = m.dataset.ids.split(',').map(Number);
    const i = ids.indexOf(state.active);
    const id = ids[(i + 1) % ids.length];
    if (state.hidden.has(state.issues[id].cat)) return;
    if (state.onlyOpen && state.status[id]) { state.onlyOpen = false; $('only-open').checked = false; renderList(); }
    select(id, 'doc');
  });

  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheets(); return; }
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!document.querySelector('.sheet-wrap:not([hidden])')) {
      if (e.key === 'j') step(1);
      if (e.key === 'k') step(-1);
    }
  });

  $('copy-all').addEventListener('click', () => {
    const items = state.issues.filter(visible);
    if (!items.length) { toast('コピーする指摘がありません'); return; }
    const lines = items.map((it) => {
      const st = state.status[it.id] === 'done' ? '［確認済み］' : state.status[it.id] === 'skip' ? '［対象外］' : '';
      return `段落${it.p + 1}\t${it.text} → ${it.suggest || '（削除）'}\t${R.CATS[it.cat].label}${it.check ? '・要確認' : ''}\t${it.note || ''}${st}`;
    });
    copyText(`${state.name}　修正箇所 ${items.length}件\n` + lines.join('\n'));
  });

  renderRuleTable();
  run();
})();
