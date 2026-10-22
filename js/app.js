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
    '補助金の申請については、予め窓口にご相談下さい。県としても、関係機関への斡旋を行い、早期に支給出来る様に努めて行きたいと考えています。',
    'では、私からは以上です。',
  ];

    userRules: store.get('userRules', ''),
    exclusions: store.get('exclusions', ''),
    monthly: typeof window.KaikenMonthly === 'string' ? window.KaikenMonthly : null,
    yoji: typeof window.KaikenYoji === 'string' ? window.KaikenYoji : null,
    issues: [],
    status: {},              // id -> 'done' | 'skip'
    choice: {},              // id -> 選んだ候補（候補が複数ある用字用例）
    fixAll: false,           // 修正文に「要確認」もすべて反映する
    hidden: new Set(),       // 非表示の分類
    onlyOpen: false,
    active: null,
      userRules: state.userRules,
      exclusions: C.parseList(state.exclusions),
      monthly: state.monthly || '',
      yoji: state.yoji || '',
    });
    state.status = {};
    state.choice = {};
    state.active = null;
    render();
  }

  const suggestOf = (it) => state.choice[it.id] ?? it.suggest;
  const visible = (it) => !state.hidden.has(it.cat) && (!state.onlyOpen || !state.status[it.id]);

  function render() {
    const chars = state.paragraphs.reduce((n, p) => n + p.length, 0);
    $('doc-stats').textContent = `${state.paragraphs.length} 段落 ・ ${chars.toLocaleString()} 字`;
    $('monthly-badge').textContent = state.monthly === null ? '今月の用語：読み込めません' : `今月の用語：${monthlyTerms().length}語`;
    $('yoji-badge').textContent = state.yoji === null ? '用字用例：読み込めません' : `用字用例：${yojiList().length}語`;
    document.documentElement.style.setProperty('--doc-size', state.size + 'px');
    const themeLabel = { system: '自動', light: 'ライト', dark: 'ダーク' }[state.theme];
    $('theme-toggle').textContent = 'テーマ：' + themeLabel;
          if (!on.length) { body += seg; continue; }
          const done = on.every((it) => state.status[it.id]);
          const cls = ['m', 'cat-' + on[0].cat, on.length > 1 ? 'is-multi' : '', done ? 'is-done' : ''].join(' ');
          const title = on.map((it) => `${R.CATS[it.cat].label}：${it.text} → ${it.suggest || '（削除）'}`).join('\n');
          const title = on.map((it) => `${R.CATS[it.cat].label}：${it.text} → ${suggestOf(it) || '（削除）'}`).join('\n');
          body += `<mark class="${cls}" data-ids="${on.map((it) => it.id).join(',')}" title="${esc(title)}">${seg}</mark>`;
        }
      }
    }
