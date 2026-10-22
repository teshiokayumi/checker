// node test/checker.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const C = require('../js/checker.js');
const R = require('../js/rules.js');

const paras = C.toParagraphs(fs.readFileSync(path.join(__dirname, 'sample.txt'), 'utf8'));
const issues = C.check(paras, { mode: 'teirei', terms: R.DEFAULT_TERMS });
const pairs = issues.map((i) => `${i.text}→${i.suggest}`);
if (process.argv.includes('-v')) issues.forEach((i) => console.log(i.p + 1, i.cat, `${i.text} → ${i.suggest || '（削除）'}`));

const has = (s) => assert.ok(pairs.includes(s), `missing: ${s}\n${pairs.join('\n')}`);
const not = (re) => assert.ok(!issues.some((i) => re.test(i.text)), `unexpected: ${re}`);

has('中→なか'); has('時→とき'); has('既に→すでに'); has('是非→ぜひ');
has('作り→づくり'); has('作る→つくる'); has('一人一人→ひとりひとり');
has('目がけ→めがけ'); has('受け止め→受けとめ'); has('形→かたち'); has('分かる→わかる');
has('どんどんどんどん→どんどん'); has('たんで→たので'); has('これによって→これにより');
has('とか→と'); has('っていう→という'); has('、、→、'); has('【幹事社】→幹事社');
has('九州山口→九州・山口'); has('ブルゴーニュ→「ブルゴーニュ」');
assert.ok(issues.some((i) => i.ruleId === 'jissai'));
assert.ok(issues.some((i) => i.ruleId === 'iwayuru'));
assert.ok(issues.filter((i) => i.ruleId === 'dewa').length === 2, 'dewa x2');
not(/^分かれ/);                 // 「分かれる」はそのまま
not(/^期間中/);
assert.ok(!issues.some((i) => i.ruleId === 'mou' && paras[i.p].slice(i.start, i.start + 3) === 'もう一'), 'もう一度は対象外');
// 「」内・中点語は対象外
const p9 = paras.findIndex((t) => t.startsWith('なお'));
assert.ok(!issues.some((i) => i.p === p9 && i.cat === 'shiryo'), 'protected terms ok');
// 本文を書き換えていない
assert.strictEqual(paras.join('\n'), C.toParagraphs(fs.readFileSync(path.join(__dirname, 'sample.txt'), 'utf8')).join('\n'));

// お出かけ知事室：発言者に【】
const od = C.check(['知事', '知事：皆さんこんにちは。', '【参加者】よろしくお願いします。'], { mode: 'odekake' });
assert.deepStrictEqual(od.filter((i) => i.cat === 'washa').map((i) => i.suggest), ['【知事】', '【知事】']);
assert.strictEqual(C.check(['【幹事社】'], { mode: 'odekake' }).filter((i) => i.cat === 'washa').length, 0);

// 追加ルール・除外語
const u = C.check(['皆様のご協力を'], { userRules: '皆様→皆さま # 職場ルール' });
assert.strictEqual(u[0].suggest, '皆さま');
assert.strictEqual(C.check(['世の中です'], { exclusions: ['世の中'] }).length, 0);
assert.strictEqual(C.detectMode(paras), 'teirei');
// 今月の用語（今月の用語.txt を実際に読み込む）
let monthly = '';
global.KAIKEN_MONTHLY = (t) => { monthly = t; };
require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, '..', '今月の用語.txt'), 'utf8'));
assert.ok(monthly.includes('熊本こころのケアセンター'));
const mi = C.check(paras, { mode: 'teirei', monthly });
const mp = paras.findIndex((t) => t.startsWith('また'));
assert.deepStrictEqual(mi.filter((i) => i.p === mp).map((i) => `${i.text}→${i.suggest}`), ['熊本心のケアセンター→熊本こころのケアセンター']);
const ex = C.check(['熊本心のケアセンター'], { monthly: '熊本心のケアセンター→熊本こころのケアセンター # 正式名称' });
assert.strictEqual(ex[0].suggest, '熊本こころのケアセンター');
assert.strictEqual(ex[0].note, '正式名称');
assert.strictEqual(C.check(['私は熊本心のケアセンターへ'], { monthly: '熊本こころのケアセンター' })[0].text, '熊本心のケアセンター');

console.log(`ok (${issues.length} issues)`);
