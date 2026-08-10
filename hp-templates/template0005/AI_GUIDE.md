# AI_GUIDE.md — tp_lp3_clinic_slide 実装ガイド

> **管理画面変数**: カラースキーム / セクション表示 / カスタムCSS / レイアウトは [`variables.json`](variables.json) が正本。適用手順は親ディレクトリの [`TEMPLATE_VARIABLES.md`](../TEMPLATE_VARIABLES.md) を参照。テキスト・写真の差し替えは本ガイドの該当章＋プレビュー編集機能。

このファイルは、無料テンプレート配布サイト「Template Party」の LP（ランディングページ）系テンプレート `tp_lp3` のクリニック（医療機関）向けスライドショー版 `tp_lp3_clinic_slide` を、実在するクリニックの本番サイトに仕上げるための作業ガイドです。

このテンプレートには通常の単一マニュアルファイルではなく、`_manual/` フォルダ内に **13個のHTMLページ**に分かれたマニュアルが同梱されています（`manual.html` が総合案内、`manual1_header.html`〜`manual12_new.html` が各セクション別解説）。本ガイドはそれら13ページ全て、実際の `index.html` / `new.html`、`css/style.css`、`css/mainimg.css`、`js/main.js`、`_removed_images_manifest.md` を実際に読み込んだ上でまとめた要約です。`_manual/` を開かなくても、このファイル1つで編集作業ができることを目指しています。

このサイトは商用ライセンス取得により、本来必須だったクレジット表記（Template Partyへのリンク）は既に全HTMLから削除済みです。また `new.html` に元々埋め込まれていたCMS宣伝バナーも削除済みです。`images/` フォルダ内のサンプル写真・ロゴ画像は**すべて削除済み**（フォルダ自体は空のまま維持）で、削除内容の記録は `_removed_images_manifest.md` にあります。

---

## 1. 概要

`tp_lp3_clinic_slide` は、フルスクリーンの写真スライドショーをメインビジュアルに使う1ページ完結型LP（ランディングページ）テンプレートです。テンプレート名の末尾が「slide」であることが示す通り、**トップの3枚（可変）の写真をフェードで自動切り替えするスライドショー**が最大の特徴です。

- **`index.html`** … サイト本体（ホーム）。ヘッダー、スライドショー、お知らせ1行バナー、「私たちのこだわり」「サービス紹介」「ご利用の流れ」「お客様の声」「よく頂く質問」「オンライン予約／お電話でのご予約」ボタン、ウェーブ装飾、フッターまで、すべてのセクションを1枚に収めたLP本体です。
- **`new.html`** … `index.html` 側の「お知らせ」1行バナーの「一覧」リンク先となる**お知らせ一覧専用の別ページ**です（CMSではなく静的HTML）。ヘッダー・フッターは共通ですが、本文は `_manual/manual12_new.html` が示す `<dl class="new">` 形式のお知らせ一覧を手動で書く設計です。

  補足: `new.html` の本文（`<main>` 内）には `_manual/manual12_new.html` と同じ `<dl class="new">` 形式のサンプルお知らせ一覧（`2000/00/00`日付のダミー6件）が入っています。実際に公開する際は、この `<dt>`/`<dd>` の中身を本物のお知らせ内容に書き換えてください（一度CMS宣伝バナーと一緒に本文ごと誤って削除されていましたが、`_manual/manual12_new.html` の内容を元に復元済みです）。

---

## 2. ページ・セクション構成

### 2-1. `index.html`（上から順）

| # | HTML範囲・目印 | セクション名（マニュアル対応） | 内容・置き換えポイント |
|---|---|---|---|
| 1 | `<header>`（17〜47行目） | manual1_header.html | ロゴ（`#logo img`, `images/logo-home.png`）、開閉メニュー（`#menubar`、アンカー6本）、ヘッダー右のボタン2つ（オンライン予約／お電話でのご予約）。背景は透明で、下のスライドショー写真が透けて見える設計。 |
| 2 | `<aside id="mainimg">`（51〜57行目） | manual2_mainimg.html | フルスクリーンの写真スライドショー。`div.slide.slide1/2/3` の3枚（枚数は増減可）。 |
| 3 | `<div class="new-top">`（61〜67行目） | manual3_newtop.html | スライドショー下部に浮かぶ1行お知らせバナー。長文は「…」で省略されるので短文専用。「一覧」リンクは `new.html` へ。 |
| 4 | `<section id="kodawari">`（77〜137行目） | manual4_kodawari.html | 「私たちのこだわり」。3つの特徴ブロック（丁寧で親身な診療対応／清潔で安心な院内環境／経験豊富な医療スタッフ）、各々に `kodawari-1/2/3.jpg` を左右交互配置。 |
| 5 | `<section id="service" class="bg1">`（141〜170行目） | manual5_service.html | 「サービス紹介」。3枚カード（一般内科診療／健康診断・人間ドック／予防接種・ワクチン接種）、`service-1/2/3.png` アイコン。背景は `.bg1`＝`--secondary-color`。 |
| 6 | `<section id="flow">`（174〜248行目） | manual6_flow.html | 「ご利用の流れ」。Step01〜Step04の4ステップ（ご予約・お問い合わせ／受付・問診票の記入／診察・検査・説明／お会計・処方・帰宅）。 |
| 7 | `<div id="voice" class="bg-slideup slideup1">`（252〜312行目） | manual7_voice.html | 「お客様の声」。横スクロールする吹き出し状カードが9枚（サンプル）。背景に `bg-slideup1.jpg` のパララックス。 |
| 8 | `<section id="faq" class="bg1">`（316〜340行目） | manual8_faq.html | 「よく頂く質問」。クリックで開閉するアコーディオン形式のFAQが4問（サンプル）。 |
| 9 | `<div class="bg-slideup slideup2"><section class="btn-box">`（344〜357行目） | manual9_btnbox.html | 「オンライン予約」「お電話でのご予約」の大きな2ボタンCTA。背景に `bg-slideup2.jpg` のパララックス、FAQとの境目にグラデーション。 |
| 10 | `<svg>` + `<div class="wave-section">`（368〜385行目） | manual10_wave.html | 波形のSVGアニメーション装飾（コンテンツとフッターの境目）。 |
| 11 | `<footer id="footer">`（389〜460行目） | manual11_footer.html | ロゴ（`logo-footer.png`）、住所・電話・受付時間、SNSアイコン4つ、診療時間表（`table.week`）、GoogleMapのiframe、コピーライト。 |

`<body class="home">` が付与されている点に注意（`new.html` にはこのクラスが無い）。`style.css` の `body:not(.home) #contents { padding-top: 10rem; padding-bottom: 10rem; }`（357行目）により、フルスクリーン写真の無いページでは上下に余白が追加される仕組みです。

### 2-2. `new.html`（上から順）

| # | 内容 | 備考 |
|---|---|---|
| 1 | ヘッダー（`index.html` と同一構造） | ロゴ画像が **`images/logo.png`**（`index.html` の `logo-home.png` とは別ファイル！詳細は5章参照）。ナビのアンカーは `index.html#kodawari` のように **`index.html` を明示したハッシュリンク**になっている（現在ページがホームではないため）。 |
| 2 | `<div id="contents"><main>` 内のお知らせ本体 | `<dl class="new">` 形式のダミーお知らせ6件が入っている（`_manual/manual12_new.html` と同内容）。本物の内容に書き換える。 |
| 3 | ウェーブ装飾 | `index.html` と同一。 |
| 4 | フッター | `index.html` と同一構造・同一画像（`logo-footer.png`）。 |

`new.html` は `<script>` の読み込みに **`js/jquery.inview_set.js` が含まれていません**（`index.html` には有る）。そのため、お知らせ本文を書く際に `up`/`down`/`transform1`〜`3`/`blur` などのスクロール演出クラス（6章参照）を使いたい場合は、`index.html` の該当 `<script src="js/jquery.inview_set.js"></script>` 行をコピーして追加する必要があります（追加しないと、クラスを付けても要素が透明なまま表示されない不具合になります）。

---

## 3. メニュー／アンカーリンクの編集方法

- ナビゲーションは `<nav><ul><li><a href="#kodawari">...</a></li>...</ul></nav>`（`index.html` 25〜33行目、`_manual/manual1_header.html` にも同構造）。リンク文言とジャンプ先セクションの `id`（`#kodawari` `#service` `#flow` `#voice` `#faq` `#footer`）はセットで変更してください。
- `new.html` 側では `index.html#kodawari` のように **ページ名を付ける**必要があります（同ページ内アンカーではないため）。
- スムーススクロールとページトップへ戻るボタン（`.pagetop`）は `js/main.js` の「スムーススクロール」ブロック（181〜222行目）が処理しています。個別編集は不要です。
- **レスポンシブのブレイクポイント変数は `js/main.js` の10行目**です。

  ```js
  const breakPoint = 9999;	// ここがブレイクポイント指定箇所です
  ```

  **重要な特有仕様**: この値が `9999`（＝現実のどんな画面幅よりも大きい）に設定されているため、`windowWidth < breakPoint` は事実上**常に真**になります。つまりこのテンプレートは現状、**PC画面幅であっても常にハンバーガーメニュー（スマホ表示）モードで動作**します（`large-screen` 用の横並びナビは実質発動しません）。これは意図的な仕様の可能性もありますが、公開前に「PCでは横並びメニューを出したい」のか「常にハンバーガーで統一したい」のかをサイト運営者に確認し、前者なら `breakPoint` を `900` など実際の値に変更してください。
- CSSレイアウト側のブレイクポイントはこれとは別に、`css/style.css` 内に個別の `@media screen and (min-width:...)` が多数あります（900px：全体基準フォントサイズ・ヘッダー横並び・こだわりブロック2カラム化など、800px：サービス3列グリッド、700px：フッター2カラム・お知らせ一覧2カラム、600px：お客様の声カードの幅、500px：ヘッダーボタンの縦積み）。これらはJSの `breakPoint` とは独立して機能します。

---

## 4. テキスト・コンテンツの編集箇所

- **`<title>`**（`index.html` 5行目・`new.html` 5行目、両方同じ文言）
  ```
  <title>動画・スライドショーのLP（ランディングページ）無料ホームページテンプレート tp_lp3</title>
  ```
  クリニック名・キャッチコピーに書き換える。
- **meta description**（両ファイル7行目）: `content="ここにサイト説明を入れます"` → 検索結果に表示される説明文に変更。
- **ロゴのalt属性**:
  - `index.html:20` `alt="あなたのサイト名"`（ヘッダー、`logo-home.png`）
  - `new.html:18` `alt="あなたのサイト名"`（ヘッダー、`logo.png`）
  - `index.html:394` / `new.html:84` `alt="SAMPLE COMPANY"`（フッター、`logo-footer.png`）
- **フッターのコピーライト**（`index.html:454`、`new.html:144`）
  ```
  <small>Copyright© あなたのサイト名 All Rights Reserved.</small>
  ```
- **フッターの住所・電話・受付時間**（`index.html:396-398`、`new.html:86-88`）
  ```
  〒000-0000 東京足立区XXXXXX1丁目1号
  代表電話：000-0000-0000
  受付時間：月曜日から金曜日の8時から18時まで
  ```
- **診療時間表**（`table.week`、`index.html:409-440`、`new.html:99-130`）: ○/△/×記号と時間帯を実際の診療時間に合わせる（△は「予約専門」、×は「休診日」という凡例が下に付いている）。
- **プレースホルダー本文**（`index.html` 内に「サンプルテキスト」が **48箇所**、`new.html` のお知らせ本文中に **5箇所**）。主なパターン:
  - `ここに挨拶文を入れます。サンプルテキスト。`（こだわりセクション、88〜123行目）
  - `ここに説明を入れます。サンプルテキスト。`（サービス紹介、151/157/163行目）
  - `説明文をここに書きます。サンプルテキスト。`（ご利用の流れ、186/203/220/237行目）
  - `さらにステップが必要ならこのブロックを使います。サンプルテキスト。`（`ul.step li`、各Stepの補足リスト。不要なら `<li>` ごと削除可）
  - `サンプル見出し。` / `サンプルテキスト。`（お客様の声カード、262〜303行目）
  - `ここに質問を書きます。クリックで回答が開きます。` / `ここに回答を書きます。サンプルテキスト。`（FAQ、323〜335行目）
- **予約・電話ボタンのリンク先**（`href="#"`、ヘッダー内 `index.html:41-42`・`new.html:39-40` と、CTAブロック `index.html:350-351`）: オンライン予約システムのURL、`tel:0312345678` のような電話リンクに差し替える。
- **SNSアイコンのリンク**（フッター `ul.sns`、`href="#"` が4つ。X／LINE／YouTube／Instagram）: 実際のアカウントURLに変更。
- **GoogleMap** は `iframe` 埋め込み（`index.html:451`、`new.html:141`）。実クリニックの地図に差し替えが必要（差し替え方法は `_manual/manual11_footer.html` から `template-party.com` の外部マニュアルへリンクされているが、`_manual/` ごと削除する場合はGoogle Maps埋め込みコード生成ページから新しいiframeコードを取得すればよい）。

---

## 5. 画像の差し替え方

`images/` フォルダは中身が空の状態で維持されています。以下は `_removed_images_manifest.md` に記録された削除済み画像の一覧です。**ファイル名を完全一致させて** `images/` フォルダに配置すれば、HTML/CSSの変更なしにそのまま表示されます。

### 5-1. メインスライドショー（最重要・このテンプレートの核）

スライドショーの実装は `<aside id="mainimg">`（`index.html` 51〜57行目）＋ `css/mainimg.css`（このテンプレートには `slide.css` という名前のファイルは無く、**`css/mainimg.css` がスライドショー専用CSS**です）＋ `js/main.js` の「スライドショー」ブロック（242〜255行目）の3点セットで動いています。

**仕組み**:
- HTML側は `<div class="slide slide1"></div>` のように、スライド1枚につき `div.slide.slideN` を1つ並べるだけ（現在は3枚）。
- `js/main.js` は `$('#mainimg .slide')` を取得して **`slides.length` で枚数を自動判定**するため、枚数を増減させてもJSの書き換えは不要です。4枚目を追加したい場合は `index.html` に `<div class="slide slide4"></div>` を1行追加し、`css/mainimg.css` に `.slide4` のスタイルブロックを1つ追加するだけでOKです。
- 各スライドは `opacity: 0` で待機し、`setInterval` で次のスライドと入れ替わりながら `opacity: 1` にフェードします。**切り替え間隔は `main.js` 254行目の `}, 4000); // 4秒ごとにスライドを切り替える` の `4000`（ミリ秒）を変更**すれば調整できます。フェードの速度自体は `css/mainimg.css` 21行目の `.slide { transition: opacity 1s; }` の `1s` で調整します。
- **横向き／縦向きで別画像を出し分ける「yoko／tate」ペア方式**が特徴です。`css/mainimg.css` を見ると:
  ```css
  .slide1 { background: url('../images/1-yoko.jpg') no-repeat center center / cover; }
  ...
  @media (orientation: portrait) {
    .slide1 { background-image: url('../images/1-tate.jpg'); }
  }
  ```
  つまり通常（横長）の画面では `1-yoko.jpg`（yoko＝横）が使われ、スマホを縦に持った時など画面が縦長（`orientation: portrait`）になると自動的に `1-tate.jpg`（tate＝縦）に切り替わります。**同じ写真の横位置トリミング版と縦位置トリミング版を2枚用意する**、という設計です。縦横で同じ画像を使いたい場合は、`_manual/manual2_mainimg.html` の説明どおり「tate側とyoko側に同じファイル名を指定すればOK」（例: `1-tate.jpg` を用意せず、CSSの `.slide1`（portrait）のurlも `1-yoko.jpg` に書き換える）。
- 背景指定は `no-repeat center center / cover` の **cover指定**なので、各スライドの画像は自分自身の縦横比に関わらず画面いっぱいに拡大トリミングされます（1枚目が他のスライドの縦横比を決めるような依存関係はありません。各スライドは独立してcoverでトリミングされます）。ただし極端に小さい画像を使うと引き伸ばされて粗くなるため、サンプル同様に横長は概ね2000px以上の幅を推奨します。
- フリー素材の配布ページ（`_manual/manual2_mainimg.html` に記載）: `https://photo-chips.com/?act=list&kind=1&html=tp_index.html`

| ファイル名 | 役割 | 元サイズ | 参照箇所 |
|---|---|---|---|
| `images/1-yoko.jpg` | スライド1枚目・横向き用 | 2500×1401 | `css/mainimg.css:26` |
| `images/1-tate.jpg` | スライド1枚目・縦向き用 | 2500×1401（サンプルは横長のまま） | `css/mainimg.css:45` |
| `images/2-yoko.jpg` | スライド2枚目・横向き用 | 2500×1401 | `css/mainimg.css:31` |
| `images/2-tate.jpg` | スライド2枚目・縦向き用 | 2000×2000（正方形） | `css/mainimg.css:50` |
| `images/3-yoko.jpg` | スライド3枚目・横向き用 | 2500×1401 | `css/mainimg.css:36` |
| `images/3-tate.jpg` | スライド3枚目・縦向き用 | 2500×1401 | `css/mainimg.css:55` |

※サンプル素材のtate（縦向き）用ファイルは、実際には正方形または横長寸法のまま配布されていた点に注意（本来「縦向き」なら縦長画像が理想）。実際のクリニック写真を用意する際は、tate用には縦長〜正方形に近い構図（人物や看板が画面上下で見切れにくい構図）を選ぶことを推奨します。

### 5-2. こだわりセクションの写真（`#kodawari`）

| ファイル名 | 役割 | 元サイズ | 参照箇所 |
|---|---|---|---|
| `images/kodawari-1.jpg` | 「丁寧で親身な診療対応」の写真（右配置＝`image-r`） | 2048×2048 | `index.html:95` |
| `images/kodawari-2.jpg` | 「清潔で安心な院内環境」の写真（左配置＝`image-l`） | 1632×1632 | `index.html:110` |
| `images/kodawari-3.jpg` | 「経験豊富な医療スタッフ」の写真（右配置＝`image-r`） | 1536×1536 | `index.html:127` |

いずれもほぼ正方形。`<div class="image-r">` / `<div class="image-l">` のクラス名で左右配置が決まる（`r`＝右、`l`＝左）。画像には `border-radius: 50px` の角丸と影が自動で付く（`css/style.css` 439〜442行目）。

### 5-3. サービス紹介のアイコン（`#service`）

| ファイル名 | 役割 | 元サイズ | 参照箇所 |
|---|---|---|---|
| `images/service-1.png` | 「一般内科診療」アイコン | 889×500 | `index.html:149` |
| `images/service-2.png` | 「健康診断・人間ドック」アイコン | 889×500 | `index.html:155` |
| `images/service-3.png` | 「予防接種・ワクチン接種」アイコン | 889×500 | `index.html:161` |

### 5-4. 装飾的な背景画像（decorative background）

| ファイル名 | 役割 | 元サイズ | 参照箇所 |
|---|---|---|---|
| `images/bg-kodawari.png` | `#kodawari` セクション背景、左上に画面幅50%で配置される装飾画像 | 1024×1024 | `css/style.css:413` |
| `images/bg-kodawari.psd` | 上記のPhotoshopソースファイル | （PSDのため寸法確認不可） | 参照なし（元データ保管用） |
| `images/bg-flow.png` | `#flow` セクション背景、右上に画面幅50%で配置される装飾画像 | 1024×1024 | `css/style.css:541` |
| `images/bg-flow.psd` | 上記のPhotoshopソースファイル | （PSDのため寸法確認不可） | 参照なし（元データ保管用） |
| `images/bg-slideup1.jpg` | 「お客様の声」ブロック（`.slideup1`）のパララックス背景 | 2000×2000 | `css/style.css:1072` |
| `images/bg-slideup2.jpg` | CTAボタンブロック（`.slideup2`）のパララックス背景 | 2000×2000 | `css/style.css:1079` |

`bg-slideup1.jpg` / `bg-slideup2.jpg` は、`js/main.js` の「背景画像が少しずつ上に移動する」ブロック（293〜323行目）でスクロールに応じて `background-position` を動かすパララックス演出に使われます。`_manual/manual7_voice.html` / `manual9_btnbox.html` の解説によると、**正方形〜縦長に近い画像を推奨**（横長すぎるとスクロールしても位置がほぼ動かず演出が効かない）。

### 5-5. ロゴ画像（2種類あることに要注意）

| ファイル名 | 役割 | 元サイズ | 参照箇所 |
|---|---|---|---|
| `images/logo-home.png` | `index.html` ヘッダーのロゴ | 1000×100 | `index.html:20` |
| `images/logo.png` | `new.html` ヘッダーのロゴ | 1000×100 | `new.html:18` |
| `images/logo.psd` | ロゴのPhotoshopソースファイル | （PSDのため寸法確認不可） | 参照なし |
| `images/logo-footer.png` | 両ページ共通、フッターのロゴ | 1000×100 | `index.html:394`, `new.html:84` |

**なぜロゴが2種類（`logo-home.png` と `logo.png`）に分かれているか**: `css/style.css` の `header { color: #fff; }`（138行目）により、ヘッダーの文字色は常に白固定です。`index.html` のヘッダーは背景が透明で、下にスライドショー写真が透けて見えるため、白系のロゴ画像（`logo-home.png`）でも視認できます。一方 `new.html` にはフルスクリーン写真が無く、ヘッダー背景は実質ただの白いページ背景になるため、`logo-home.png` と同じ白いロゴを使うと**白地に白ロゴで見えなくなってしまいます**（`_manual/manual1_header.html` にも「※ロゴが白で見えないので、ヘッダー背景をグレーにしています」という検証用の注記があります）。そのためテンプレートは `new.html` 用に別ファイル `logo.png` を用意する設計になっていると考えられます。実際の画像を用意する際は、**`logo-home.png`＝写真の上に乗せても読める白抜き・明るい配色のロゴ**、**`logo.png`＝白背景の上でも読めるダークカラー版（または枠付き）のロゴ**、という2パターンを用意してください（単純に同じロゴを複製配置すると、`new.html` 側でロゴが見えなくなる可能性があります）。

---

## 6. 配色・フォントサイズの調整方法

色は `css/style.css` 冒頭の CSS カスタムプロパティ（`:root`、23〜37行目）で一括管理されています。

```css
:root {
  --primary-color: #4476b9;          /*テンプレートのテーマカラー*/
  --primary-inverse-color: #fff;     /*primary-colorの対となる色（文字色などに使用）*/

  --secondary-color: #30363d;        /*テンプレートのサブカラー*/
  --secondary-inverse-color: #fff;   /*secondary-colorの対となる色*/

  --accent-color: #c43311;           /*テンプレートのアクセントカラー*/
  --accent-inverse-color: #fff;      /*accent-colorの対となる色*/

  --content-space: 4rem;             /*左右余白などの一括管理用（4rem＝4文字分）*/
}
```

主な使用箇所:
- `--primary-color`: ヘッダー開閉メニュー背景（`#menubar`）、フッター背景（`#footer`）、お客様の声カードの背景と吹き出し先端（`.list-yoko-scroll .list`）、FAQの「＋」アイコン背景（`.faq dt::before`）、「ご利用の流れ」各Stepタイトル背景（`.flow-box .title h3`）、ウェーブの色（`.wave-wrap use { fill: var(--primary-color); }`）、サービス紹介の見出し文字色。
- `--secondary-color`: `.bg1` クラスの背景色（サービス紹介セクション・FAQセクションの背景に使用）、CTAボタンブロック上部のグラデーション（`.slideup2::before`）。
- `--accent-color`: 予約・電話ボタン（`.btn a`）の背景色。
- `--content-space`: `section` の左右パディング、ヘッダーの左右パディング、フッターのパディングなど、余白を横断的に統一。

色を変える場合は `:root` の値だけを書き換えれば、テンプレート全体に反映されます（`var(--primary-color)` のように参照している箇所を1つずつ探して直す必要はありません）。

フォントサイズ:
- 基準フォントサイズは `css/style.css` 60行目 `html,body { font-size: 13px; }`。画面幅900px以上では `css/style.css` 67行目の `@media screen and (min-width:900px) { html, body { font-size: 15px; } }` で `15px` に切り替わります（他の多くの余白・文字サイズ指定が `rem` 単位のため、この基準値を変えるとサイト全体のスケールが連動して変わります）。
- 本文フォントは `body { font-family: "Hiragino Kaku Gothic Pro", ... }`（75行目）でヒラギノ／メイリオ系のゴシック体を指定。`style.css` 冒頭12行目で Google Fonts の Noto Sans JP も `@import` 済みですが、現状どの `font-family` 宣言にも使われていません（差し替えたい場合はこの `@import` はそのままに、`body` の `font-family` にフォント名を追加してください）。
- Font Awesome（アイコンフォント）は `style.css` 7行目で CDN から読み込み。アイコンはヘッダーボタン、SNS、FAQなど随所で `<i class="fa-solid fa-xxx">` のように使用。差し替え方法は `_manual/manual.html` の「アイコン画像について」を参照（削除予定なら公式サイト `https://fontawesome.com/v6/search` でアイコン名を確認）。

---

## 7. その他このテンプレート特有の仕組み

- **ウェーブ（波形）装飾**（`manual10_wave.html` 対応）: `<svg>` 内の `<path id="wavePath">` を `<use>` で2回並べて無限ループさせるSVGアニメーションです（`css/style.css` 828〜874行目、`animation: move-wave 10s linear infinite`）。波の速度は `10s` を、波の高さは `.wave { height: 80px; }` を変更しますが、**高さを変える場合は `.wave-section` の `padding-top` / `top` / `margin-bottom` の3箇所の数値（いずれも「高さ－1px」）も揃えて変更する必要があります**（コメントに明記あり）。色は `--primary-color` 依存。
- **CTAボタン（オンライン予約／お電話でのご予約）**: ヘッダー右上（`#header-box`）とページ中盤のCTAブロック（`.btn-box`）の2箇所に同じボタンセットが登場し、共通の `.btn a` スタイル（`css/style.css` 759行目〜）を共有しています。中盤側は `.bg-slideup.slideup2` というパララックス背景の中に置かれ、直前の「よく頂く質問」セクションとの境目には `.slideup2::before` によるグラデーションがかけられています（不要ならこのブロックごと削除可、と `manual9_btnbox.html` に明記）。
- **お客様の声（横スクロールカード）**: `.list-yoko-scroll` は `overflow-x: auto` ＋ `scroll-snap-type: x mandatory` によるスマホ的な横スワイプUIです。偶数番目のカードだけ `transform: translateY(30px)` で下にずらして千鳥配置にし、`::before` の `▲` 文字で吹き出しの先端を表現しています（画像は使わずCSSのみ）。背景は `.bg-slideup.slideup1` によるパララックス。
- **FAQアコーディオン**: `dl.faq > dt.openclose2` をクリックすると `js/main.js`（261〜270行目）が該当 `dd` を `slideToggle()` し、**他の開いている項目は自動的に閉じる**（＝同時に1つしか開かない）仕様です。開閉アイコンは画像ではなく `::before` の擬似要素コンテンツ（`＋` / `ー`）を `.active` クラスの有無で切り替えています。
- **見出しの1文字ずつフェードインアニメーション**（`fade-in-text`）: 各セクション見出し（`<span class="fade-in-text">`）に共通で使われている演出です。要素が画面内に入ると（`jquery.inview` プラグイン経由）、`js/main.js` の「テキストのフェードイン効果」ブロック（329〜347行目）がテキストを1文字ずつ `<span class="char">` に分解し、`animation-delay` を `0.1s` 刻みでずらして表示します。なめらかさは `css/style.css` の `.char { animation: fadeIn 0.2s linear both; }` の `0.2s` で、文字ごとの時差は `js/main.js` 内の `0.1` の数値で調整します。
- **汎用スクロール演出（up/down/transform1/transform2/transform3/blur）**: `css/inview.css` と `js/jquery.inview_set.js` によって提供される、要素に `class="up"` 等を付けるだけで使えるスクロールインの演出セットです。「こだわり」ブロックの各カードに `up` クラスが付いているのが実例（`<div class="list up">`）。他のセクションにも自由に追加転用できます。
- **未使用（デッドコード）に見える仕組み**: `js/main.js` には `.box` / `.title` を対象にした「コンテンツが終了するまで見出しをstickyで固定」処理（276〜287行目）がありますが、`index.html` / `new.html` のどこにも `class="box"` は存在しません。同シリーズの別テンプレートの使い回しコードと見られ、実害はありませんが削除しても問題ありません。同様に `setDynamicHeight()` が設定する CSS変数 `--vh`（226〜236行目）も、現状どの `css` ファイルからも参照されていません。
- **`new.html` はパララックス用スクリプトが1本足りない**: `index.html` は `js/jquery.inview_set.js` を読み込みますが、`new.html` はこの `<script>` タグを含んでいません。お知らせ本文に `up` 等の演出クラスを使う場合は追加が必要です（2章参照）。

---

## 8. 公開前に削除・整理してよいファイル

- **`tp_lp3_clinic_slide/_manual/` フォルダ一式**（`manual.html`、`manual1_header.html` 〜 `manual12_new.html` の計13ファイル）。`index.html` / `new.html` のどちらからもリンクされていない、制作者向けの参考資料です。本番公開前に丸ごと削除して問題ありません。
- **`tp_lp3_clinic_slide/_removed_images_manifest.md`**。AI／開発者が画像を復元・差し替えする際の内部参照用メモであり、サイト自体には組み込まれていません。公開前に削除して問題ありません。
- **`template-party.com` への残存リンク**（削除ではなく、内容の見直し・置き換えを推奨。必須のクレジット表記ではなく、GoogleMapの変更方法を案内する外部チュートリアルへのリンクです）:
  - `index.html:449` `<p><a href="https://template-party.com/file/pickup_googlemap.html">GoogleMapの地図を変更する方法はマニュアルをご覧下さい。</a></p>`
  - `new.html:139` 同内容の行
  - このリンク文言・href は制作者向けの案内であり、実際の来訪者に見せる想定ではありません。GoogleMapを差し替えた時点でこの文自体を削除するか、地図の下の補足文言として書き換えることを推奨します。

上記以外（`css/`、`js/`、`index.html`、`new.html`、`images/`）は本番サイトの動作に必要なため、そのまま残してください。
