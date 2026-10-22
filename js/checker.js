/*
 * 会見録チェッカー：検出エンジン
 * 本文は書き換えず、指摘（位置・修正候補・理由）の一覧だけを返します。
 */
(function (root, factory) {
  const rules = (typeof module === 'object' && module.exports) ? require('./rules.js') : root.KaikenRules;
  const api = factory(rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KaikenChecker = api;
})(typeof self !== 'undefined' ? self : this, function (R) {
  const { RULES, CHARS } = R;

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function expand(tpl, m) {
    if (typeof tpl === 'function') return tpl(m);
    return tpl.replace(/\$(\d|&)/g, (_, k) => (k === '&' ? m[0] : (m[+k] ?? '')));
  }

  function findAll(re, text) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      out.push(m);
    }
    return out;
  }

  // 「」『』の中と、中点でつながった語（九州・山口 など）は書き換え対象から外す
  const QUOTE_RE = /「[^「」]*」|『[^『』]*』/g;
  const DOT_RE = new RegExp(`[${CHARS.WORD}]+(?:・[${CHARS.WORD}]+)+`, 'g');
  const toRanges = (ms) => ms.map((m) => [m.index, m.index + m[0].length]);
  const overlaps = (a, b, ranges) => ranges.some(([s, e]) => a < e && s < b);

  // 資料表記：「〜」付きの語はかぎかっこ抜け、中点付きの語は中点抜けを検出
  function termRules(terms) {
    const out = [];
    for (const raw of terms || []) {
      const t = String(raw).trim();
      if (!t) continue;
      const q = t.match(/^「(.+)」$/) || t.match(/^『(.+)』$/);
      if (q) {
        out.push({ id: 'shiryo:' + t, cat: 'shiryo', from: t, to: t, protect: 'quote',
          re: new RegExp(escRe(q[1]), 'g'), note: `資料表記：「${q[1]}」はかぎかっこ付きでそのまま使う` });
      } else if (t.includes('・')) {
        const parts = t.split('・').filter(Boolean).map(escRe);
        if (parts.length < 2) continue;
        out.push({ id: 'shiryo:' + t, cat: 'shiryo', from: t, to: t, protect: 'quote',
          re: new RegExp(parts.join('[、，,\\s　]?'), 'g'), note: `資料表記：「${t}」は中点（・）付きでそのまま使う` });
      }
    }
    return out;
  }

  // 追加ルール：1行に「検出→候補 # メモ」。検出を /〜/ で囲むと正規表現
  function parseUserRules(text) {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const body = line.replace(/\s+#.*$/, '').trim();
      if (!body || body.startsWith('#')) return;
      const memo = (line.match(/\s#\s*(.*)$/) || [])[1] || '';
      const parts = body.split(/\s*(?:→|->|=>|⇒)\s*/);
      const from = parts[0];
      const to = parts.length > 1 ? parts.slice(1).join('') : '';
      if (!from) return;
      let re;
      const rx = from.match(/^\/(.+)\/$/);
      try { re = new RegExp(rx ? rx[1] : escRe(from), 'g'); } catch (e) { return; }
      out.push({ id: 'user:' + i, cat: 'user', from, to, re,
        note: memo || (to ? `「${from}」→「${to}」` : `「${from}」は削除`) });
    });
    return out;
  }

  const parseList = (text) => String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  /**
   * paragraphs: string[]
   * opts: { mode, terms: string[], userRules: string, exclusions: string[] }
   * returns: [{ id, p, start, end, text, suggest, cat, ruleId, note, check }]
   */
  function check(paragraphs, opts = {}) {
    const mode = opts.mode || 'teirei';
    const rules = RULES.filter((r) => !r.mode || r.mode === mode)
      .concat(termRules(opts.terms), parseUserRules(opts.userRules));
    const exclusions = (opts.exclusions || []).filter(Boolean);
    const issues = [];
    const seen = new Set();

    paragraphs.forEach((text, p) => {
      const quotes = toRanges(findAll(QUOTE_RE, text));
      const dots = toRanges(findAll(DOT_RE, text));
      const excl = [];
      for (const w of exclusions) excl.push(...toRanges(findAll(new RegExp(escRe(w), 'g'), text)));

      for (const rule of rules) {
        const protect = rule.protect || 'all';
        for (const m of findAll(rule.re, text)) {
          const start = m.index, end = start + m[0].length;
          if (protect !== 'none' && overlaps(start, end, quotes)) continue;
          if (protect === 'all' && overlaps(start, end, dots)) continue;
          if (overlaps(start, end, excl)) continue;
          if (rule.filter && !rule.filter(m)) continue;
          const suggest = expand(rule.to, m);
          if (suggest === m[0]) continue;
          const key = `${p}:${start}:${end}:${rule.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          issues.push({ p, start, end, text: m[0], suggest, cat: rule.cat, ruleId: rule.id,
            note: rule.note, check: !!rule.check });
        }
      }
    });

    issues.sort((a, b) => a.p - b.p || a.start - b.start || b.end - a.end);
    issues.forEach((it, i) => { it.id = i; });
    return issues;
  }

  // 本文から会見の種別を推定（見つからなければ null）
  function detectMode(paragraphs) {
    const head = paragraphs.slice(0, 15).join('\n');
    if (/お出かけ知事室/.test(head)) return 'odekake';
    if (/定例(?:記者)?会見/.test(head)) return 'teirei';
    return null;
  }

  // Word から取り出したテキストを段落に分ける
  const toParagraphs = (raw) => String(raw || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');

  return { check, detectMode, toParagraphs, parseUserRules, parseList, termRules };
});
