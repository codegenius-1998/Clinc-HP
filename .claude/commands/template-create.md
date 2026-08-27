---
description: 参考サイトURLから、個人クリニック向けサイトを「テンプレート形式(template.json + 静的HTML/CSS/JS)」で生成する
argument-hint: "[参考サイトURL...]（省略時はプロジェクトルートの /aaa.md を読む）"
---

# /template-create — URL → テンプレート形式のクリニックサイト

あなたは **Webデザイナー / アートディレクター / フロントエンドエンジニア** として動作する。
参考サイトの「見た感じ・雰囲気・デザイン思想(Design DNA)」を人間の目で理解し、それを
**個人クリニック向けのオリジナルサイト**として、このリポジトリの**テンプレート形式**に落とす。

単純なコピー・クローンは禁止。参考サイトの HTML/CSS/JS/画像/ロゴ/固有イラスト/文言/className を
流用しない。取り込むのは比率と印象(色・タイポ・余白・グリッド・階層・温度感)だけ。

---

## 0. このリポジトリのテンプレート形式（前提・必読）

サイトの中身は **1つの JSON** に集約されている。コンポーネントにハードコード文字列は無い。

| ファイル | 役割 |
|---|---|
| `src/components/sections/data/template.json` | **全データ**(meta / theme{colors,fonts} / brand / contact / layout / nav / sections.*)。ここだけ書けばサイトが変わる |
| `src/components/sections/data/template.schema.json` | 上の JSON Schema。**フィールドの型・必須・enum はこれが正**。書く前に読む |
| `src/components/sections/data/template.ts` | JSON に型付けして配布(`themeStyle` / `fontHref` / `content` / `clinic` / `treatments` / `layout`) |
| `src/components/sections/registry.ts` | `type:variant` → セクションコンポーネント |
| `src/components/sections/<Name>/` | 各セクション(`.tsx` + `.module.css`)。**JSON から描画する。基本は触らない** |
| `src/components/sections/ui/Illustration.tsx` | 組み込みイラスト(inline SVG)。名前は schema の `illustration` enum |
| `src/components/sections/site.css` | トークンの**既定値**・リセット・モーション。**色/フォントの実値はここに書かない**(theme が上書きする) |
| `public/nj-motion.js` | スクロール reveal / カウントアップ / ヘッダー影 / 進捗バー / アンカーのヘッダー分オフセット。**既存で足りる。増やさない** |
| `src/app/preview/<slug>/page.tsx` | プレビュールート。`template.ts` を読んで `layout` を描画するだけ(全 slug 同一・汎用) |
| `scripts/export-static.mjs` | `/preview/<slug>` → `public/_generated/<slug>/` に静的化(下記「7」) |

**成果物 = `template.json` の更新 + `public/_generated/<slug>/`(HTML/CSS/JS + JSON 一式)。**
新しい `.tsx`/`.css` や `site.css` の色追加、`clinic.ts` 等への記述は原則しない。

---

## 1. 入力（参考サイトURL）

1. `$ARGUMENTS` があれば、それが参考サイトURL(スペース/改行区切りで複数可)。`/aaa.md` は読まない。
2. `$ARGUMENTS` が空のときだけ、プロジェクトルートの `/aaa.md` からURLを取得。
3. URLが1つも無ければ、その旨を報告して停止。

---

## 2. ワークフロー

```text
URL取得
  ↓ 参考サイトを「人間の目で」観察(コードを読むだけにしない)
Visual Analysis → First Impression / Visual Personality(各0〜10)
  ↓
Design DNA 作成(色 / タイポ / 余白 / コンテナ / グリッド / 角丸 / 影 / 画像の質感 /
               ヘッダー・ヒーロー・カード・CTA の型 / スクロールの間 / 温度感)
  ↓
現在のプロジェクト構成を確認(package.json / registry.ts / template.schema.json / 既存 template.json)
  ↓
DB の departments を確認(下記「4」)。架空クリニックの科目・サービスの芯にする
  ↓
layout(セクションの顔ぶれ + variant)を決定
  ↓
template.json を1ファイルとして書く(下記「5」「6」)
  ↓
プレビュー確認 → 必要なら template.json を直す
  ↓
静的化(下記「7」) → 完成
```

工程を勝手に飛ばさない。ただし**実装対象は基本 `template.json` だけ**なので速い。

---

## 3. Design DNA（参考サイトから取り込むもの）

内部的に次を言語化する。CSS値の羅列で終わらず「**なぜそう見えるのか**」まで。

```json
{
  "visualPersonality": { "cleanliness": 0, "warmth": 0, "trust": 0, "luxury": 0,
    "modernity": 0, "friendliness": 0, "professionalism": 0, "minimalism": 0,
    "softness": 0, "medicalFeeling": 0, "localFeeling": 0 },
  "colorSystem": {},   "typography": {}, "spacing": {}, "container": {}, "grid": {},
  "borderRadius": {},  "shadow": {},     "imageStyle": {},
  "header": {}, "hero": {}, "sectionPatterns": {}, "cardPatterns": {}, "buttonPatterns": {},
  "animation": {}, "responsive": {}, "overallMood": ""
}
```

避けるもの(=「AIっぽい」): 過剰な gradient / glassmorphism / 意味のない blob / 全セクション card 化 /
どこにでも CTA / 均一すぎる余白 / 不自然な英語見出し / 過剰な shadow・角丸・animation。
**実在しそうな個人クリニック**に見えることを最優先。

---

## 4. DB の departments を確認する

`src/lib/content.ts` の `listDepartments()` 相当、または `scripts/` の D1 ヘルパで
`departments` / `services` を確認する(読み取りのみ)。

- 取得できた科目を、架空クリニックの**診療案内(`sections.medical.items`)の芯**にする。
- DB に無い固有の事実(装置名・症例数・資格・経歴)は**書かない**。一般的な範囲の記述に留める。
- 情報が足りない箇所は、既存のクリニック像から自然な日本語で補う(医療広告として不自然にしない、
  効果を保証する表現を使わない)。

---

## 5. template.json の書き方（フィールド対応表）

**必ず `template.schema.json` を読み、`additionalProperties:false` と `required` と enum に従う。**
`data/template.ts` の `Content` 型が実際の消費側。

| JSON パス | 中身 | Design DNA との対応 |
|---|---|---|
| `meta.title` / `meta.description` | `<title>` / `<meta description>` | — |
| `theme.colors.{primary,primaryDeep,accent,tint,paper,ink,inkSoft,line}` | `#rrggbb`。`.nj-site` にインライン CSS 変数で載り `site.css` を上書き | **colorSystem** をそのまま数値化。`ink` は黒でなく温度のある本文色、`tint` は交互セクションの淡い地色 |
| `theme.fonts.heading` / `.body` | `{ family, weights:[400,500,700], fallback }`。family は **Google Fonts の family 名と一致**させる。`useGoogleFonts:true` で `<link>` を自動生成 | **typography**。丸ゴシック感 / 明朝感 / モダンさを Google Fonts から選ぶ。fallback は日本語の同系(丸ゴシックなら Hiragino Maru 等) |
| `theme.fonts.headingTracking` | 見出しの `letter-spacing`(例 `"0.1em"`) | typography |
| `brand.{name,nameEn,logo}` | 架空クリニック名。`logo.src` は基本 `null`(→組み込みSVGマーク) | — |
| `contact.{phone,phoneCaption,reserveUrl,reserveLabel,address}` | ダミー固定(`00-0000-0000` / `〒000-0000 …` / `https://lin.ee/0000000`)。予約手段は実在するものだけ | header/hero/contact/footer の CTA |
| `layout[]` | `{type, variant}` の配列。並び・削除・重複可。type は schema の enum、variant は `registry.ts` に登録済みのもの | **sectionPatterns**。情報量と DNA で顔ぶれを決める |
| `nav[]` | ヘッダーメニュー。各 `href` は `#<セクションid>`。**セクションと1対1**にする | header |
| `header.actionBar[]` | モバイル下部バー。`href` は `"tel"` / `"reserve"` / `"#id"` | header |
| `sections.hero` | `image`(src:null 可) / `headlineLines`(1要素=1行、`*…*` がアクセント色) / `sub` / `reserveLabel` | hero |
| `sections.schedule` | `heading` / `cornerLabel` / `emptyMark` / `days[]` / `rows[{label,marks[]}]`(marks は days と同長、休診は `null`) / `notes[]` | — |
| `sections.news` | `heading` / `items[{date,title}]` | — |
| `sections.reasons` | `heading` / `items[{no,icon,title,body}]`。`icon` は illustration enum(`explain`/`shopping`/`kids` 等) | cardPatterns |
| `sections.greeting` | `heading` / `image`(院長ポートレート、src:null 可) / `doctorName` / `doctorRole` / `message[]` | imageStyle |
| `sections.philosophy` | `heading` / `lead`(大きく出す一文) / `body[]` | — |
| `sections.medical` | `heading` / `items[{key,icon,ja,en,lead}]`。`icon` は illustration enum。**DB departments を反映** | cardPatterns |
| `sections.fees` | `heading` / `disclaimer` / `groups[{group,items[{name,price,note?}]}]` | — |
| `sections.flow` | `heading` / `steps[{no,title,body}]`。`no` は `"01"` 形式(JSでカウントアップ) | — |
| `sections.faq` | `heading` / `items[{q,a}]` | — |
| `sections.access` | `heading` / `image`(地図、src:null 可) / `points[]` / `info[{term,lines[]}]` | — |
| `sections.contact` | `heading` / `lead` / `reserveLabel` / `phoneCaption` / `note` | buttonPatterns |
| `sections.footer` | `nav[{href,label}]` / `copyright` | — |

文章は日本の個人クリニックとして自然に。短すぎず長すぎず、患者が理解しやすく、AIっぽくしない。

---

## 6. 画像

- **原則すべて `image.src: null`** → 各セクションが組み込みのプレースホルダ SVG を出す(自己完結・軽量)。
- 実画像を使う場合のみ `src` に**外部URL または data URI** を入れる(`alt` も書く)。ローカルファイルは置かない。
- 装飾アイコン(診療案内・選ばれる理由)は `Illustration.tsx` の enum から `icon` で選ぶ。
  新しい絵柄が要るときだけ `Illustration.tsx` に `name` を1つ足し、schema の `illustration` enum にも追記する。

---

## 7. 静的化（HTML/CSS/JS + JSON 一式）

1. slug を決める(クリニック名の英字ケバブ、例 `hanada-dental`)。
2. `src/app/preview/<slug>/page.tsx` が無ければ、既存 `src/app/preview/nojima/page.tsx` を**そのままコピー**して作る
   (中身は汎用。doc コメントの医院名だけ直す)。
3. 型・lint・ビルドを1回ずつ: `npx tsc --noEmit && npm run lint && npm run build`。
4. 別ターミナルで `npm run start`(または `npm run dev`)。
5. `npm run export -- <slug>` → `public/_generated/<slug>/` に:
   - `index.html`(組み立て済み1枚)
   - `css/site.css` `css/ui.css` `css/<section>.css`(セクションごと)
   - `html/<section>.html`(セクションごと・先頭にヘッダーメニュー付き)
   - `js/motion.js`
   - `template.json` + `template.schema.json`
6. `file://.../public/_generated/<slug>/index.html` を開いて崩れないこと、`grep -R "_next" index.html` が空を確認。

---

## 8. プレビュー確認（Visual Review）

ブラウザ(ブラウザペイン)で `/preview/<slug>` を開き、次を人間の目で確認する。

```text
First impression / Header / Hero / セクション間の余白 / Typography /
画像の収まり / コンテナ幅 / CTA / モバイル(375px) / 全体の一貫性
```

判断基準:**「参考サイトを人間が見たときに感じた Design DNA が、この架空クリニックに再構成されているか」**。
不足があれば `template.json` を直して再確認(コンポーネントは触らない)。

---

## 9. やってはいけない

- 参考サイトの HTML/CSS/JS/文言/画像/ロゴ/固有イラスト/className をコピーする
- `site.css` に色やフォントの実値を書く(theme が担う)
- `data/clinic.ts` / `departments.ts` / `sections.ts` に記述を戻す(shim のまま)
- 既存セクションコンポーネントを、そのセクションの意味が変わらないのに書き換える
- `nj-motion.js` に機能を足す / セクションごとに新しい JS を作る
- DB に無い固有の事実を断定する / 存在しない予約手段・資格・経歴を作る
- 既存機能・DB・API・認証・環境変数を壊す
- 変更のたびに `npm run build` を回す(最後に1回)

---

## 10. 完成条件

```text
[ ] URL を取得し、参考サイトを人間の目で分析した
[ ] Visual Personality を 0〜10 で評価し、Design DNA を作った
[ ] DB の departments を確認し、診療案内の芯にした(固有事実は断定しない)
[ ] template.schema.json に従って template.json を1ファイルで書いた
[ ]   theme.colors を DNA の colorSystem から数値化した
[ ]   theme.fonts を DNA の typography に合う Google Fonts にした
[ ]   layout / nav をセクションと1対1で決めた
[ ]   全セクションの文言を自然な日本語で埋めた / 画像は src:null(または外部URL)
[ ] /preview/<slug> をブラウザで確認し、Design DNA の再現を確認した
[ ] tsc / lint / build が通る
[ ] npm run export -- <slug> で public/_generated/<slug>/ に HTML/CSS/JS + JSON が出た
[ ] index.html に _next 参照が無い
[ ] 参考サイトの単純コピーになっていない / AIっぽくない
[ ] 既存機能を壊していない
```

報告は簡潔に(例: 「Design DNA 作成 → template.json 生成 → /preview/hanada-dental 確認 → export 完了」)。
