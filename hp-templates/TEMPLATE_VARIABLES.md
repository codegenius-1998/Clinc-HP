# テンプレート変数仕様（AI / 管理画面向け）

この文書は、クリニックHPテンプレートを **管理画面・プレビュー編集・AI変換** から制御できるようにするための機械可読な契約です。  
テキスト修正・写真差し替えは別機能（プレビュー編集）で扱う前提です。ここでは次の4つを変数化します。

1. **カラースキーム切替**（青・緑・紺・ピンクなど）
2. **セクションの表示/非表示**
3. **カスタムCSSの注入**
4. **レイアウト微調整**（カラム数・余白など）

---

## ファイル構成（各テンプレート共通）

```
tp_xxx/
  variables.json          ← 正本。管理画面・AIが読む設定
  index.html              ← data-theme / data-section フック付き
  css/
    style.css / theme.css ← 既存デザイン
    site-controls.css     ← テーマプリセット・表示制御・レイアウト変数
    custom.css            ← 管理画面が書き込む追加CSS（初期は空）
  AI_GUIDE.md             ← 人手向け詳細（コンテンツ編集など）
```

ルートの JSON Schema: [`schema/template-variables.schema.json`](schema/template-variables.schema.json)

---

## AIが従うべき適用手順（必ずこの順）

`variables.json` を変更したら、同じディレクトリの静的ファイルへ反映する。

| 手順 | 対象 | 操作 |
|---|---|---|
| 1 | `index.html` の `<html>` | `data-theme="{colorScheme.active}"` をセット |
| 2 | 各セクション要素 | `data-section="{id}"` と `data-visible="true\|false"` をセット。`visible=false` のときナビ内の `href="#{id}"` を持つ `<li>` も非表示または削除 |
| 3 | `index.html` の `<html style="...">` または `css/site-controls.css` の `:root` | `layout.*.cssVar` に `layout.*.value` を書き込む |
| 4 | `css/custom.css` | `customCss.content` の文字列で**ファイル全体を置換**（空文字可） |
| 5 | （任意）`colorScheme.options[active].tokens` | `site-controls.css` の `html[data-theme="..."]` ブロックと一致していることを確認。新規スキーム追加時は両方に追記 |

**やってはいけないこと**

- 別テンプレートの `variables.json` のキー名・セレクタを流用しない（テンプレートごとに `selector` / `cssVar` が違う）
- `css/style.css` の色を手で大量置換しない（カラースキームは `data-theme` + CSS変数で切り替える）
- `custom.css` 以外にインラインで大量CSSを散らさない

---

## 変数カテゴリ

### A. `colorScheme` — カラースキーム

- `active`: 現在のスキーム ID（例: `"blue"`）
- `options`: 選択可能なスキーム辞書
  - 各 option は `label`（管理画面表示名）と `tokens`（CSSカスタムプロパティの上書き値）を持つ

**適用先**: `<html data-theme="blue">`  
**実装**: `css/site-controls.css` の `html[data-theme="blue"] { --primary-color: ... }`

共通スキーム ID（テンプレートが対応するものだけ `options` に載せる）:

| ID | 用途イメージ |
|---|---|
| `blue` | 信頼感のある青 |
| `skyblue` | 明るいスカイブルー |
| `green` | やさしい緑 |
| `navy` | 落ち着いた紺 |
| `pink` | 柔らかいピンク |
| `coral` | サンゴピンク |
| `olive` | オリーブ（介護・ホーム系） |

### B. `sections[]` — セクション表示/非表示

各要素:

| フィールド | 意味 |
|---|---|
| `id` | 論理名（安定キー。管理画面・AIが使う） |
| `label` | 日本語表示名 |
| `selector` | HTML上のCSSセレクタ（例: `#staff`） |
| `visible` | `true` / `false` |
| `navHrefs` | 連動して隠すナビリンクの `href` 一覧（例: `["#staff"]`） |
| `removable` | 管理画面でトグル可能か（`false` なら常時表示推奨） |

**適用先 HTML**:

```html
<section id="staff" data-section="staff" data-visible="true">
```

**適用先 CSS**（`site-controls.css` 済み）:

```css
[data-section][data-visible="false"] { display: none !important; }
```

### C. `layout` — レイアウト微調整

各キー（例: `staffColumns`）:

| フィールド | 意味 |
|---|---|
| `label` | 管理画面表示名 |
| `value` | 現在値（数値またはCSS長） |
| `cssVar` | 書き込むCSS変数名 |
| `min` / `max` | 数値のときのみ |
| `unit` | 任意（説明用） |
| `appliesTo` | 効くセレクタの説明（人間/AI向け） |

代表キー:

- `staffColumns` → `--layout-staff-columns`
- `serviceColumns` → `--layout-service-columns`
- `contentSpace` → テンプレ既存の余白変数（`--content-space` / `--content-space-l` / `--global-space` のいずれか。`cssVar` を正とする）

### D. `customCss` — カスタムCSS注入

```json
"customCss": {
  "file": "css/custom.css",
  "content": "/* 管理画面からの追加CSS */\n.hero { min-height: 70vh; }\n"
}
```

- `index.html` はすでに `<link rel="stylesheet" href="css/custom.css" id="site-custom-css">` を読み込む
- プレビュー時は `content` をそのまま `custom.css` に書き出せば即反映

### E. コンテンツ（参照のみ・別機能）

`contentSlots` / `imageSlots` はテキスト・写真差し替え用の**索引**です。  
実編集はプレビュー画面側の機能で行い、この JSON は AI が「どこを触るか」を知るためのマップです。

---

## 管理画面 UI との対応（実装ヒント）

| UI | 読むキー | 書き戻し先 |
|---|---|---|
| カラースキーム選択 | `colorScheme.options` / `active` | `html[data-theme]` + `variables.json` |
| セクションON/OFF | `sections[].visible` | `data-visible` + ナビ + `variables.json` |
| カラム数スライダー | `layout.*.value` | CSS変数 + `variables.json` |
| 追加CSSテキストエリア | `customCss.content` | `css/custom.css` + `variables.json` |

---

## テンプレートごとの差異

各 `tp_*/variables.json` の `meta.themeFile` / `sections` / `layout` が正本。  
索引の人間向けガイドは [`AI_GUIDE.md`](AI_GUIDE.md)。変数操作は **必ず `variables.json` を先に読む**。

## 例: グリーンに変え、FAQを隠し、カラムを2列にする

`tp_clinic7_blue/variables.json` を次のように変え、静的ファイルへ反映する。

```json
{
  "colorScheme": { "active": "green" },
  "sections": [
    { "id": "staff", "visible": true },
    { "id": "facility", "visible": false }
  ],
  "layout": {
    "staffColumns": { "value": 2, "cssVar": "--layout-staff-columns" }
  },
  "customCss": {
    "content": "h2 { letter-spacing: 0.05em; }\n"
  }
}
```

反映結果のイメージ:

```html
<html lang="ja" data-theme="green" style="--layout-staff-columns:2;--layout-facility-columns:3;--content-space-l:5vw">
...
<section id="facility" data-section="facility" data-visible="false">
```

```css
/* css/custom.css */
h2 { letter-spacing: 0.05em; }
```

ナビの `href="#facility"` を持つ `<li>` も合わせて非表示にする。

---

`_apply_variables_hooks.py` は初回ブートストラップ用。ランタイムの正本は各 `variables.json` と上記適用手順。
