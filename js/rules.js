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
      note: '動詞「作る」の連用形 →「つくり」', check: true },
    { id: 'tsukuru', cat: 'hyoki', from: '作る', to: 'つく$1',
      re: /作([らるれろっ])/g, note: '「作る」→「つくる」（作って→つくって など活用形も）' },
    { id: 'hitorihitori', cat: 'hyoki', from: '一人一人', to: 'ひとりひとり',
      re: /一人一人/g, note: '「一人」→「ひとり」', check: true },
    { id: 'hitori', cat: 'hyoki', from: '一人', to: 'ひとり',
      re: new RegExp(`(?<![${K}0-9０-９])一人(?!一人|者)`, 'g'),
      note: '「一人」→「ひとり」（人数として数える場合は要確認）', check: true },
    { id: 'megakete', cat: 'hyoki', from: '目がけ', to: 'めがけ',
      re: /目(?:がけ|掛け)/g, note: '「目がけて」→「めがけて」' },
    { id: 'uketome', cat: 'hyoki', from: '受け止め', to: '受けとめ',
      re: /受け?止め/g, note: '「受け止め」→「受けとめ」' },
    { id: 'katachi', cat: 'hyoki', from: '形', to: 'かたち',
      re: new RegExp(`(?<![${K}])形(?![${K}])`, 'g'),
      note: '「形」→「かたち」（「形成」「円形」などの熟語は対象外）', check: true },
    { id: 'wakaru', cat: 'hyoki', from: '分かる', to: 'わか$2',
      re: /([分解])か([らりるっろ]|れば)/g,
      note: '「分かる」→「わかる」（「分かれる」はそのまま）' },
    { id: 'hitotsume', cat: 'hyoki', from: '1つ目・ひとつ目', to: (m) => KANSUJI[toHankaku(m[1])] + 'つ目',
      re: /([1-9１-９]|ひと|ふた|みっ|よっ|いつ|むっ|なな|やっ|ここの)つ目/g,
      note: '「〇つ目」は漢数字で「一つ目」と表記' },

    // ── 重複 ──────────────────────────────────────────
    { id: 'kurikaeshi', cat: 'chofuku', from: 'どんどんどんどん', to: '$1$1',
      re: new RegExp(`([${HIRA}${KATA}]{2,3})\\1{2,}`, 'g'),
      note: '同じ語の繰り返しは2回まで（例：どんどんどんどん→どんどん）' },
    { id: 'kurikaeshi-kanji', cat: 'chofuku', from: '同じ語句の連続', to: '$1',
      re: new RegExp(`([${K}${HIRA}${KATA}]{2,8}?)\\1`, 'g'),
      filter: (m) => new RegExp(`[${K}]`).test(m[1]) && !/^一/.test(m[1]), // 「一人一人」「一つ一つ」は除く
      note: '同じ語句が続いています（言い直し・言いよどみ）', check: true },

    // ── 削除候補（言いよどみ・つなぎの言葉）────────────────────
    { id: 'jissai', cat: 'sakujo', from: '実際', to: '',
      re: /実際(?:に)?[、，]?/g, note: '「実際」は削除（文意が変わらないか確認）', check: true },
    { id: 'mou', cat: 'sakujo', from: 'もう', to: '',
      re: /もう(?!一|ひと|少し|すこし|すぐ|ちょっと|け|かる|し|ける|か)[、，]?/g,
      note: '「もう」は削除（「もう一度」「もう少し」は対象外）', check: true },
    { id: 'iwayuru', cat: 'sakujo', from: 'いわゆる', to: '',
      re: /いわゆる[、，]?/g, note: '「いわゆる」は削除' },
    { id: 'dewa', cat: 'sakujo', from: '（文頭の）では', to: '',
      re: /(?<=^[\s　]*|[。！？】][\s　]*)では[、，]?/g,
      note: '文頭の「では」は削除（「東京では」などの助詞は対象外）', check: true },

    // ── 話し言葉 ───────────────────────────────────────
    { id: 'nde', cat: 'hanashi', from: '〜んで', to: '$1ので',
      re: /([たるいなだ])んで(?![すしぇ])/g,
      note: '「〜んで」→「〜ので」（例：ついていたんで→ついていたので）', check: true },
    { id: 'niyotte', cat: 'hanashi', from: 'これによって', to: '$1により',
      re: /(これ|それ)によって/g, note: '「これによって」→「これにより」' },
    { id: 'toka', cat: 'hanashi', from: '〜とか', to: 'と',
      re: /(?<!なん|何|どう)とか(?![くしすさせ])/g,
      note: '「〜とか」→「〜と」（並列が続く場合は「〜や〜など」も検討）', check: true },
    { id: 'teiu', cat: 'hanashi', from: '〜ていう', to: 'という',
      re: /っ?て(?:いう|言う)/g,
      note: '「〜ていう／〜っていう」→「〜という」（「改めて言う」などは対象外）', check: true },

    // ── 話者表記（会見の種別で切り替え）────────────────────────
    { id: 'kanji-kakko', cat: 'washa', mode: 'teirei', from: '【幹事社】', to: '$1', protect: 'none',
      re: /【(幹事[社者][^】]*)】/g, note: '定例記者会見では幹事者に【】を付けない' },
    { id: 'washa-colon', cat: 'washa', mode: 'odekake', from: '知事：', to: '【$1】', protect: 'none',
      re: /(?<=^[\s　]*)(?!【)([^\s　。、，．「」【】：:]{1,12})[：:]/g,
      note: 'お出かけ知事室では発言者を【】で囲む' },
    { id: 'washa-line', cat: 'washa', mode: 'odekake', from: '発言者だけの行', to: '【$1】', protect: 'none',
      re: /(?<=^[\s　]*)(?!【)(?![^]*(?:[0-9０-９]|会見|知事室|以上))([^\s　。、，．「」【】：:！？]{1,15})(?=[\s　]*$)/g,
      note: 'お出かけ知事室では発言者を【】で囲む（発言者名の行でなければ対象外）', check: true },

    // ── 記号・空白 ─────────────────────────────────────
    { id: 'kutoten', cat: 'kigo', from: '、、／。。', to: '$1', protect: 'none',
      re: /([、。，．！？])\1+/g, note: '句読点が重なっています' },
    { id: 'kutoten-mix', cat: 'kigo', from: '、。', to: '。', protect: 'none',
      re: /、。|。、/g, note: '読点と句点が続いています' },
    { id: 'kuhaku', cat: 'kigo', from: '文中の空白', to: '', protect: 'none',
      re: new RegExp(`(?<=[${HIRA}${KATA}${K}])[ 　]+(?=[${HIRA}${KATA}${K}])`, 'g'),
      filter: (m) => m.input.includes('。'), // 見出し・日付の行は対象外
      note: '文中に空白があります（文字起こしの区切りの残り）', check: true },
  ];

  // 資料表記の初期値：「」や中点（・）があるものはそのまま使う
  const DEFAULT_TERMS = ['九州・山口', '「ブルゴーニュ」'];

  return { CATS, MODES, RULES, DEFAULT_TERMS, CHARS: { K, HIRA, KATA, WORD } };
});
