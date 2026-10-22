/*
 * 会見録チェッカー：表記ルール定義
 *
 * 職場の表記メモ（定例記者会見／お出かけ知事室）をもとにしたルールです。
 * ルールを追加・変更するときはこのファイルを編集してください。
 *
 *   id     : ルールの識別子
 *   cat    : 分類（CATS のキー）
 *   from   : ルール一覧に表示する「検出する表記」
 *   to     : 修正候補。文字列なら $1〜$9（キャプチャ）と $&（一致全体）が使えます。
 *            関数なら一致結果 m を受け取り候補文字列を返します。
 *   re     : 検出用の正規表現（必ず g フラグ）
 *   note   : 指摘に表示する説明
 *   check  : true なら「要確認」（文脈によっては直さない）
 *   mode   : 'teirei'（定例記者会見）/ 'odekake'（お出かけ知事室）のときだけ使う
 *   protect: 'all'   … 「」内と中点（・）を含む語は対象外（既定）
 *            'quote' … 「」内だけ対象外
 *            'none'  … どこでも検出
 *   filter : 一致結果 m を受け取り、false を返すと指摘しない
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KaikenRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const K = '\\u4E00-\\u9FFF\\u3005';           // 漢字＋々
  const HIRA = '\\u3041-\\u3096';
  const KATA = '\\u30A1-\\u30FA\\u30FC';        // カタカナ＋ー
  const WORD = `${K}${KATA}A-Za-z0-9０-９Ａ-Ｚａ-ｚ`; // 中点でつながる語の構成文字

  const CATS = {
    hyoki:   { label: '表記統一' },
    sakujo:  { label: '削除候補' },
    hanashi: { label: '話し言葉' },
    chofuku: { label: '重複' },
    washa:   { label: '話者表記' },
    shiryo:  { label: '資料表記' },
    kigo:    { label: '記号・空白' },
    user:    { label: '追加ルール' },
    monthly: { label: '今月の用語' },
    yoji:    { label: '用字用例' },
  };

  const MODES = {
    teirei:  { label: '定例記者会見', hint: '幹事者は【】なし' },
    odekake: { label: 'お出かけ知事室', hint: '発言者は【】あり' },
  };

  const KANSUJI = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
    'ひと': '一', 'ふた': '二', 'みっ': '三', 'よっ': '四', 'いつ': '五', 'むっ': '六', 'なな': '七', 'やっ': '八', 'ここの': '九' };
  const toHankaku = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

  const RULES = [
    // ── 表記統一（漢字→ひらがな など）──────────────────────────
    { id: 'naka', cat: 'hyoki', from: '中', to: 'なか',
      re: new RegExp(`(?<![${K}])中(?![${K}])`, 'g'),
      note: '「中」→「なか」（「〜の中で」など。「期間中」「中国」などの熟語は対象外）', check: true },
    { id: 'toki', cat: 'hyoki', from: '時', to: 'とき',
      re: new RegExp(`(?<![${K}0-9０-９])時(?![${K}])`, 'g'),
      note: '「時」→「とき」（「〜した時」など。「時間」「3時」などは対象外）', check: true },
    { id: 'sude', cat: 'hyoki', from: '既に', to: 'すでに',
      re: /既に/g, note: '「既」→「すで」' },
    { id: 'zehi', cat: 'hyoki', from: '是非', to: 'ぜひ',
      re: /是非(?![をがの])/g, note: '「是非」→「ぜひ」（「是非を問う」の意味ならそのまま）' },
    { id: 'zukuri', cat: 'hyoki', from: '〜作り', to: 'づくり',
      re: new RegExp(`(?<=[${K}${HIRA}${KATA}])(?<![をがはもにでとへやの])作り`, 'g'),
      note: '複合語の「作り」→「づくり」（例：まちづくり、ものづくり）', check: true },
    { id: 'tsukuri', cat: 'hyoki', from: '作り（動詞）', to: 'つくり',
      re: new RegExp(`(?:(?<![${K}${HIRA}${KATA}])|(?<=[をがはもにでとへやの]))作り`, 'g'),
