---
description: 参考サイトURLを見て、その場で HTML/CSS/JS + JSON 一式を書き起こす（固定コンポーネントは使わない）
argument-hint: "[参考サイトURL...]（省略時はプロジェクトルートの /aaa.md を読む）"
---

# /template-create — URL を見て HTML/CSS/JS + JSON を書き起こす

あなたは **Webデザイナー / アートディレクター / フロントエンドエンジニア**。
指定された参考サイトを**実際に開いて人間の目で観察**し、その Design DNA を理解したうえで、
**個人クリニック向けのオリジナル1ページサイト**を、**その場で HTML・CSS・JS・JSON として書き起こす**。

参考サイトの HTML/CSS/JS/画像/ロゴ/固有イラスト/文言/className は流用しない。
取り込むのは比率と印象（色・タイポ・余白・グリッド・階層・温度感・セクションの流れ）だけ。

---

## 0. これまでとの違い（重要）

**固定のテンプレートは使わない。** これまでは `src/components/sections/*`（`*.module.css` /
`Illustration.tsx` / `registry.ts` / Next の `/preview` ルート）を JSON で差し替えていたが、
それだと**どの URL でも構造・見た目がほぼ同じ**になる。今回はそれを使わない。

- `*.module.css` は書かない・読まない・コピーしない
- `Illustration.tsx` は使わない（アイコンは各サイト用に inline SVG を自分で描く）
- `registry.ts` / `src/app/preview/*` / `scripts/export-static.mjs` は経由しない
- Next.js のビルドも通さない

**あなたが `public/_generated/<slug>/` に直接ファイルを書く。** URL が違えば、HTML の構造・
CSS のクラス名・余白スケール・セクション順・装飾モチーフも変わる。前回の生成物を再利用しない。

---

## 1. 入力（参考サイトURL）

1. `$ARGUMENTS` があれば、それが参考サイトURL（スペース/改行区切りで複数可）。`/aaa.md` は読まない。
2. `$ARGUMENTS` が空のときだけ、プロジェクトルートの `/aaa.md` からURLを取得。
3. URLが1つも無ければ、その旨を報告して停止。

---

## 2. 成果物

```
public/_generated/<slug>/
  template.json          構造化データ（theme{colors,fonts,spacing,radius,container} / meta /
                         brand / contact / layout（順序つき）/ nav / sections{...}）。
                         index.html はこの JSON を具体化したもの。両者を常に一致させる。
  index.html             組み立て済みの1枚。<!doctype html> から自分で書く。フレームワーク無し。
  css/base.css           トークン（DNA の実値）+ リセット + 基本タイポ + コンテナ + モーション
  css/<section-id>.css   使ったセクションごとに1枚（`.nj-site .<id>` にスコープ）
  html/<section-id>.html セクションごとの生マークアップ（下記「12」）。先頭に `<header>` メニュー
                         （＋ inline SVG のシンボル定義があればそれも）を含め、単体で使えるようにする。
                         index.html には触れず別途切り出す
  js/site.js             依存なしの進歩的拡張（無くても表示は完全に成立）。
                         `public/nj-motion.js` をそのまま写して出発点にしてよい（下記「8」）
  assets/                写真プレースホルダ（SVG）。写真が入る場所のぶんだけ置く（下記「7」）
    assets/README.md     どのファイルがどこで使われ、どの縦横比か。差し替え手順
  README.md              これは何か / 画像について / 直し方
```

`<slug>` はクリニック名の英字ケバブ（例 `midori-hifuka`）。既存 `<slug>/` があれば作り直す。

---

## 3. 大原則

- **参考サイトをコピーしない。** DNA（方向性・色・タイポ・余白・グリッド・階層・CTA の見せ方・
  スクロールの間・温度感・セクションの流れ）だけを取り込む。
- **URL ごとに別物にする。** マークアップ・クラス名・余白スケール・セクション順・装飾は
  その参考サイト固有のものにする。
- **自己完結。** 外部参照は `<head>` の Google Fonts `<link>` だけ。`_next` も CDN スクリプトも
  外部画像も無し（実写URLをユーザーが渡した場合を除く）。
- **画像は多めに。** すきまだらけにしない。装飾は inline SVG で密度を出し、写真が入る場所は
  `assets/` のプレースホルダ SVG を `<img>` で参照する（下記「7」）。
- **`template.json` と `index.html` を一致させる。** 文言・色・フォント・セクション順を両方に同じく反映。
- **AIっぽさを避ける。** 過剰な gradient / glassmorphism / blob / 全セクション card 化 / どこにでも CTA /
  均一すぎる余白 / 不自然な英語見出し / 過剰な shadow・角丸・animation。実在しそうな個人クリニックに。

---

## 4. ワークフロー

```text
URL取得
  ↓ ブラウザペインで開く（preview_start / navigate）。スクショ desktop + 375px
  ↓ 人間の目で観察 + javascript_tool で実測（下記「5」）
Design DNA 作成（personality 0〜10 / トークン実値 / セクション棚卸し / 並び / カード・CTA の型）
  ↓
DB の departments 確認（下記「6」）→ 架空クリニックの診療内容の芯に
  ↓
架空クリニックの人格を決める（名称・院長名。資格や経歴は捏造しない）
セクションの顔ぶれと順番を決める（参考サイトの流れを、クリニックとして自然に再構成）
  ↓
template.json を書く（下記「9」）
  ↓
assets/ に写真プレースホルダ SVG を用意（下記「7」）
  ↓
public/_generated/<slug>/ に index.html / css/*.css / js/site.js / README.md を書く（下記「10」「11」「8」）
  ↓
index.html をセクションごとに html/<id>.html へ切り出す（下記「12」）
  ↓
レビュー（下記「13」）→ 直す（生成物を直接編集。template.json も同時に更新）
  ↓
検証（_next 無し / 全 <link><script><img> が解決 / console error 無し）→ 完成
```

工程を勝手に飛ばさない。

---

## 5. Design DNA（人間の目 + 実測）

まず「最初に見た印象」を言語化：清潔 / 高級 / 温かい / 親しみ / モダン / ナチュラル / 医療感 /
地域密着 / ファミリー向け / 女性向け など。次に 0〜10：
`cleanliness / warmth / trust / luxury / modernity / friendliness / professionalism /
minimalism / softness / medicalFeeling / localFeeling`。

**実測**（`javascript_tool` で `getComputedStyle` などを使う）：

```text
主要色（背景 / 本文 / 見出し / リンク / CTA / 帯 / 罫線）… #rrggbb で
フォント（heading / body の family、weight、本文 font-size、行間、字間）
見出しの2段（和文 + 英字）の有無、見出しの色（本文色か、主色か）
コンテナ最大幅 / 左右ガター
セクション上下 padding のリズム / セクション間の余白
余白スケール（4/8/12/16/24/32/48/64/96 …）
border-radius（sm/md/lg）/ shadow の有無と強さ
ヘッダーの段構成（utility bar / brand+phone / nav bar など）
ヒーローの型（全幅写真 + 文字重ね / 分割 / コピー主体 / 図形の塊）
カード・リストの型 / CTA の色と形 / 画像の比率・角丸・配置
装飾モチーフ（水彩・植物・幾何・ドット・帯…）と、スクロールで現れる演出の有無
```

DNA は CSS 値の羅列で終わらず「**なぜそう見えるのか**」まで。

---

## 6. DB の departments を確認

D1 の `departments` / `services` を読み取り（`scripts/` の HTTP ヘルパ、または
`src/lib/content.ts` 相当）、クリニック種別に合う科目を、**診療内容セクションの芯**にする。
DB に無い固有の事実（装置名・症例数・資格・経歴）は書かない。不足は一般的な範囲の自然な日本語で補う
（医療広告として不自然にしない。効果を保証する表現を使わない）。

---

## 7. 画像（装飾 + 写真プレースホルダ）

参考サイトが画像で密度を出しているなら、こちらも密度を出す。方針は2つ。

### 7-1. 装飾は inline SVG で

- **アイコン**：診療案内の各カード・特長・受診の流れなどに、そのサイトの線の太さ・角の丸さに
  合わせた小さな線画アイコンを付ける（`stroke="currentColor"` で親 CSS が色を決める）。
- **見出しの飾り**：`.heading::after` を単なる線ではなく、小さな植物・幾何などのモチーフに
  （`data:image/svg+xml,…` を `background` に。`#` は `%23`）。
- **地の装飾**：DNA の装飾モチーフ（水彩のにじみ = `radial-gradient` + `blur`、植物線画 = inline SVG、
  帯の紋様など）を複数セクションに散らす。`position:absolute` + `overflow:clip` ではみ出しを隠す。

### 7-2. 写真は `assets/` のプレースホルダを `<img>` で

写真が入る場所（ヒーロー、院長ポートレート、院内のようす、地図 …）は、`null` にせず
**`assets/<name>.svg` にデザインしたプレースホルダを置き**、`<img src="assets/<name>.svg" alt="…">`
で参照する。`template.json` の該当 `image.src` もそこに向ける。

- プレースホルダ SVG は配色・縦横比を本番に合わせ、`待合スペース` などの小さなラベルを入れて
  「写真枠」と分かるように。ただの灰色ベタにしない。
- **ルート `<svg>` に必ず `width` と `height` 属性を付ける**（`viewBox` だけだと `<img>` で 0×0 に
  なる環境がある）。あわせて CSS 側でその枠に `aspect-ratio` を指定する。
- **「院内のようす」など写真が主役のセクションを最低1つ**は layout に入れる（3枚程度の横並び）。
- `assets/README.md` に「どのファイルがどこで使われ、どの縦横比か・差し替え手順」を書く。

`image` の指定：`{ "src":"assets/hero.svg", "alt":"" }`。ユーザーが実写URLを渡したときだけ
`"src":"https://…"`。ローカルの写真ファイルは同梱しない（プレースホルダのみ）。

---

## 8. `js/site.js`（進歩的拡張・任意）

`public/nj-motion.js` を **そのまま `js/site.js` に写して出発点にしてよい**（スクロール reveal /
`[data-nj-count]` カウントアップ / ヘッダー影 / スクロール進捗バー / アンカーのヘッダー分オフセット /
モバイルメニュー閉じ。すべて「無くても困らない」もの）。

写す場合、HTML 側でそのフック名に合わせる：
`.nj-site`（ルート）/ `.nj-reveal` または `[data-nj-anim]` / `.nj-progress` / `[data-nj-parallax]` /
`#nj-nav`（メニュー開閉 checkbox）/ `header nav a[href^="#"]` / `[data-nj-count]` `[data-nj-pad]` /
`.nj-spark`（きらきら）。CSS 側の初期状態は `.nj-site.nj-js` の下にだけ置く（JS 無しなら全部見える）。

参考サイトに tab / カルーセル等、これで足りない挙動があるときだけ、依存なしで自分で足す。
静的セクションに無理に JS を付けない。

---

## 9. `template.json` の形

スキーマは固定しない（レンダリングが都度自作なので）。おおむね次の形にする。値は DNA の実測から。

```jsonc
{
  "meta": { "title": "…", "description": "…" },
  "theme": {
    "colors": { "primary":"#…","primaryDeep":"#…","accent":"#…","tint":"#…",
                "paper":"#…","ink":"#…","inkSoft":"#…","line":"#…" },
    "washes": { "pink":"#…", "blue":"#…", "…": "#…" },   // 装飾用のパステル（DNA にあれば）
    "fonts": {
      "googleHref": "https://fonts.googleapis.com/css2?family=…&display=swap",
      "heading": "\"Family Name\", <日本語フォールバック>",
      "body":    "\"Family Name\", <日本語フォールバック>",
      "headingTracking": "0.08em"
    },
    "container": "1080px",
    "gutter": "clamp(1.25rem, 5vw, 2.5rem)",
    "space": ["4px","8px","12px","16px","24px","32px","48px","64px","96px"],
    "radius": { "sm":"4px","md":"12px","lg":"20px" },
    "sectionPadding": "72px"
  },
  "brand":   { "name":"…","nameEn":"…","logo": null },
  "contact": { "phone":"00-0000-0000","phoneCaption":"…",
               "reserveUrl":"https://lin.ee/0000000","reserveLabel":"…",
               "address":"〒000-0000　…" },
  "layout": [ {"id":"hero","kind":"hero"}, {"id":"points","kind":"features"},
              {"id":"greeting","kind":"greeting"}, {"id":"medical","kind":"services"},
              {"id":"gallery","kind":"gallery"}, {"id":"hours","kind":"schedule"},
              {"id":"access","kind":"access"}, {"id":"contact","kind":"cta"} ],
  "nav": [ {"href":"#hero","label":"ホーム"}, {"href":"#points","label":"当院の特長"}, … ],
  "sections": {
    "hero":    { "kind":"hero", "image": { "src":"assets/hero.svg", "alt":"" },
                 "headline": ["気になる症状を、", "*早めに*ご相談ください"],
                 "sub":"…", "cta": { "label":"…", "href":"reserve" } },
    "points":  { "kind":"features", "heading": {"ja":"当院の特長","en":"Points"},
                 "items": [ { "icon":"skin", "title":"…", "body":"…" }, … ] },
    "greeting":{ "kind":"greeting", "heading": {"ja":"ごあいさつ","en":"Greeting"},
                 "image": { "src":"assets/doctor.svg", "alt":"院長 …" },
                 "doctorName":"…","doctorRole":"院長","message":["…","…"] },
    "medical": { "kind":"services", "heading": {"ja":"診療案内","en":"Medical"},
                 "items": [ { "icon":"skin", "ja":"…","en":"…","lead":"…" }, … ] },
    "gallery": { "kind":"gallery", "heading": {"ja":"院内のようす","en":"Our clinic"},
                 "intro":"…", "items":[ { "image":{"src":"assets/room-1.svg","alt":"待合"}, "caption":"待合" }, … ] },
    "hours":   { "kind":"schedule", "heading": {…},
                 "days":["月","火","水","木","金","土","日/祝"],
                 "rows":[ {"label":"9:30 - 12:30","marks":["●","●","●","●","●","●",null]}, … ],
                 "notes":["…"] },
    "access":  { "kind":"access", "heading": {…}, "image": { "src":"assets/map.svg", "alt":"地図" },
                 "points":["…"], "info":[ {"term":"診療時間","lines":["…"]} ] },
    "contact": { "kind":"cta", "heading": {…}, "lead":"…",
                 "reserveLabel":"…","phoneCaption":"お電話","note":"…" }
  }
}
```

- `kind` は目安の語彙：`hero / features / greeting / philosophy / services / gallery / fees / flow /
  faq / news / schedule / access / cta / header / footer`。参考サイトに合わせて増減・改名してよい。
- `headline` は 1 要素 = 1 行。`*…*` で囲んだ部分をアクセント色にする（HTML では `<em>`）。
- `icon` は各サイト用に描く inline SVG の名前（自由文字列）。HTML に直接そのアイコンを埋める。
- `image` は `{ "src":"assets/…svg", "alt":"…" }`（写真枠）。実写URLをユーザーが渡したときだけ URL。
- 電話・住所・予約URLはダミー固定（`00-0000-0000` / `〒000-0000 …` / `https://lin.ee/0000000`）。

---

## 10. `index.html` の組み立て

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{meta.title}</title>
  <meta name="description" content="{meta.description}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{theme.fonts.googleHref}">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/<section-id>.css">   <!-- 使った順に -->
  <script src="js/site.js" defer></script>
</head>
<body>
  <div class="nj-site" style="--nj-primary:{…}; --nj-primary-deep:{…}; … --nj-font-head:{…}; …">
    <!-- 使うなら inline SVG のシンボル定義（<svg width=0 height=0><symbol id=…>…） -->
    <div class="nj-progress" aria-hidden></div>
    <header> … nav（`href="#id"`、和文 + 英字の2段があれば踏襲）、電話、予約CTA、
             モバイルは `#nj-nav` checkbox + label でメニュー開閉 … </header>
    <section id="hero"> … </section>
    <section id="points" class="nj-reveal"> … </section>
    …
    <footer> … </footer>
  </div>
</body>
</html>
```

- テーマ変数（色・フォント）は `.nj-site` の **インライン `style`** に置く（`template.json` を編集したら
  ここを書き換えるだけで反映できる）。それ以外の値（余白・角丸・コンテナ幅）は `css/base.css` の
  `.nj-site { --… }` に置いてよい。
- セクションの `<section>` に `id`（nav とリンク）と、出現アニメ用に `nj-reveal`（または子要素に
  `data-nj-anim`）を付ける。ヒーローの背景に視差を付けるなら `[data-nj-parallax]`。
- 見出しは、参考サイトが和文（大）+ 英字（小）の2段なら踏襲。見出しの色は実測どおり
  （本文色のことも多い。むやみに主色にしない）。
- 装飾 SVG のシンボルを `<use href="#…">` で使うなら、定義用の `<svg>` を `.nj-site` 直下に一度置く。

---

## 11. `css/` の書き方

**`css/base.css`**（1枚）：
```css
html, body { margin: 0; padding: 0; }            /* ← 必須。忘れると 8px ずれる */
.nj-site {
  --nj-primary: …; --nj-primary-deep: …; --nj-accent: …; --nj-tint: …;
  --nj-paper: …; --nj-ink: …; --nj-ink-soft: …; --nj-line: …;
  --nj-font-head: …; --nj-font-body: …; --nj-head-tracking: …;
  --nj-container: {theme.container}; --nj-gutter: {theme.gutter};
  --nj-s1: 4px; … --nj-s8: 96px;                 /* DNA の余白スケール */
  --nj-radius-sm/md/lg: …;
  --nj-section-pad: {theme.sectionPadding};
  font-family: var(--nj-font-body); color: var(--nj-ink); background: var(--nj-paper);
  line-height: 1.75; overflow-x: clip;
}
.nj-site *, .nj-site *::before, .nj-site *::after { box-sizing: border-box; }
.nj-site :where(h1,h2,h3,h4,p,figure,ul,ol,dl,dd) { margin: 0; }   /* :where() = 0 詳細度 */
.nj-site :where(ul,ol) { list-style: none; padding: 0; }
.nj-site :where(a) { color: inherit; text-decoration: none; }
.nj-site :where(img) { display:block; max-width:100%; height:auto; }
/* コンテナ */
.nj-site .container { width:100%; max-width:var(--nj-container); margin-inline:auto; padding-inline:var(--nj-gutter); }
/* モーション（js/site.js が .nj-js を付ける。JS 無しなら全部見える） */
.nj-site.nj-js :where(.nj-reveal,[data-nj-anim]) { opacity:0; transform:translateY(24px);
  transition:opacity .7s cubic-bezier(.22,.68,.3,1), transform .7s cubic-bezier(.22,.68,.3,1);
  transition-delay: var(--nj-anim-delay,0s); }
.nj-site.nj-js .nj-reveal.is-visible, .nj-site.nj-js [data-nj-anim].is-visible { opacity:1; transform:none; }
.nj-site .nj-progress { position:fixed; inset:0 auto auto 0; height:3px; width:0; z-index:60;
  background:linear-gradient(90deg,var(--nj-accent),var(--nj-primary-deep)); transition:width .1s linear; pointer-events:none; }
.nj-site header[data-nj-scrolled] { box-shadow: 0 6px 22px color-mix(in srgb, var(--nj-primary-deep) 12%, transparent); }
.nj-site section[id] { scroll-margin-top: var(--nj-header-h, 84px); }
@media (prefers-reduced-motion: reduce) {
  .nj-site.nj-js :where(.nj-reveal,[data-nj-anim]) { opacity:1; transform:none; transition:none; }
  .nj-site .nj-progress { display:none; }
}
```
色・フォント・余白・角丸・コンテナ幅の**実値は DNA から**。上は骨組みの例。

**`css/<section-id>.css`**：そのセクションだけ。必ず `.nj-site .<id> …` にスコープ。
- セクション背景は `--nj-paper` / `--nj-tint` / 帯（`--nj-primary` 等）を**交互**に（隣接同色を避ける。
  実測で確認する）。影を使わない DNA ならフラットに。
- 1カラムの grid で子に `max-width` を付けるときは `grid-template-columns: minmax(0, 1fr)`
  （`1fr` だと min-content で膨らんで横に溢れる）。
- ワイドな表などは `overflow-x:auto` の中でローカルスクロールさせ、ページを横スクロールさせない。

**レスポンシブ**：desktop / tablet / 375px。ヘッダー・ヒーロー・グリッド・タイポ・余白・CTA・画像の
収まりを確認。横スクロールを出さない。

---

## 12. HTML をセクションごとに分ける

`index.html` を書いたら、**セクションごとに `html/<section-id>.html` へ切り出す**（CSS と同じ粒度）。

- 各ファイル = 先頭に `<!-- … -->` の由来コメント → inline SVG のシンボル定義（あれば）→
  `<header>`（メニュー）→ そのセクションの `<section id="…">…</section>`。
  → 単体で（CMS 等に貼っても）成立する。
- `header.html` はヘッダーだけ（セクションを含めない）。`footer.html` はヘッダー + `<footer>`。
- `index.html` 自体は組み立て済みのまま置いておく（触らない）。
- 切り出しは `index.html` の `<!-- ===== id ===== -->` マーカを頼りに機械的にやってよい
  （使い捨ての node スクリプトを scratchpad に書いて実行 → 破棄）。

---

## 13. レビュー

生成物をブラウザで開いて人間の目で確認する。

- 開き方：`cd public/_generated/<slug> && python3 -m http.server 8123`（または `npx --yes serve -l 8123 .`）
  を別プロセスで起こし、`tabs_create` で新規タブ →『http://localhost:8123/』を `navigate`。
  （`file://` は相対パスや data: スナップショットで壊れやすいので http サーバを使う）。
- 実測で確認：`javascript_tool` で 1280px と 375px の両方。
  - `document.documentElement.scrollWidth === clientWidth`（横スクロール無し）
  - 全 `<img>` が `naturalWidth > 0`（プレースホルダ含む）
  - セクション背景の並びに隣接同色が無い
  - `.nj-site` に `.nj-js` が付く / reveal・進捗バー・`--nj-header-h` が動く
  - console error 無し / `_next` 参照無し
- 人間の目：First impression / Header / Hero / セクション間の余白 / Typography / 画像の収まり /
  コンテナ幅 / CTA / モバイル(375px) / 全体の一貫性。
- 判断：**「参考サイトを人間が見たときの Design DNA が、この架空クリニックに再構成されているか」**。
- 直すときは生成物（index.html / css / html/ / assets/ / template.json）を直接編集して整合を保つ。

---

## 14. やってはいけない

- 参考サイトの HTML/CSS/JS/文言/画像/ロゴ/固有イラスト/className をコピーする
- `src/components/sections/*`（`*.module.css` / `Illustration.tsx` / `registry.ts`）を使う・コピーする
- Next.js のルートやビルド、`scripts/export-static.mjs` を経由する
- 前回の生成物のマークアップ・クラス名・セクション順をそのまま流用する（URL が違えば別物にする）
- `_next` 参照や CDN スクリプトを残す / 画像を外部依存にする（実写URLをユーザーが渡した場合を除く）
- 写真枠を灰色ベタや `null` のまま放置する（`assets/` にデザインしたプレースホルダを置く）
- DB に無い固有の事実を断定する / 存在しない予約手段・資格・経歴を作る
- 既存機能・DB・API・認証・環境変数を壊す

---

## 15. 完成条件

```text
[ ] URL を取得し、ブラウザで開いて人間の目で分析した（desktop + 375px スクショ）
[ ] personality を 0〜10 で評価し、色・タイポ・余白・装飾モチーフを実測して Design DNA を作った
[ ] DB の departments を確認し、診療内容の芯にした（固有事実は断定しない）
[ ] 架空クリニックの名称・院長名を決めた（資格・経歴は捏造しない）
[ ] template.json を書いた（theme の実値 / layout・nav / 全セクションの文言 / image は assets か実写URL）
[ ] 装飾を inline SVG で入れた（見出し飾り・アイコン・地の装飾）／ 写真枠は assets/ のプレースホルダ
[ ] 「院内のようす」など写真主役のセクションを1つは入れた
[ ] public/_generated/<slug>/ に index.html / css/ / js/site.js / assets/ / README.md を書いた
[ ] index.html をセクションごとに html/<id>.html へ切り出した（先頭に <header> 付き）
[ ] index.html と template.json の文言・色・フォント・セクション順が一致している
[ ] http サーバで開いて 1280/375px を実測（横スクロール無し / 全 img 読込 / console error 無し / _next 無し）
[ ] Design DNA が架空クリニックに再構成されている
[ ] 参考サイトの単純コピーでない / 前回の生成物の使い回しでない / AIっぽくない
[ ] 既存機能を壊していない
```

報告は簡潔に（例：「DNA 作成 → template.json → public/_generated/<slug>/（html/・assets/ 込み）生成
→ localhost で実測 → 完了」）。
