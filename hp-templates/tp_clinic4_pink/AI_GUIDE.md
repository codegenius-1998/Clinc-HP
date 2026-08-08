# AI_GUIDE.md — tp_clinic4_pink テンプレート改修ガイド

このファイルは、無料HTMLテンプレート配布サイト「Template Party」の医療機関向けテンプレート `tp_clinic4`（ピンク配色版）を、実在する個人クリニックの本番ホームページへ改修するための作業ガイドです。今後このディレクトリを触るAIアシスタント、またはサイト運営者（非エンジニア）が、コードベース全体を読み直さなくても迷わず作業できることを目的としています。

**重要**: このテンプレートは元々 **18ページのマルチページ構成**でしたが、本改修で **`index.html` 1枚だけの単一ページ（LP／ランディングページ）構成**に作り直しました。旧ページ（`info.html`・`medical.html`・`staff.html`・`faq.html`・`access.html`・`contact.html`など）はすべて削除済みで、内容は `index.html` 内の各`<section id="...">`にアンカーリンク形式で統合されています（2章参照）。旧テンプレートの解説を含んだ古い版のこのガイドを参照している場合は、内容が一致しませんのでこの版を正としてください。

このサイトはすでに Template Party の有償ライセンスによりクレジット表記（著作権表示）とテンプレート内の宣伝用「ご利用前にお読みください」的な案内は全HTMLから削除済みです。また `images/` フォルダ内のサンプル写真・ロゴ画像は全て削除済み（フォルダ自体は残置）で、`_removed_images_manifest.md` にその一覧と参照箇所が記録されています。本ガイドはその削除済み画像を実際のクリニック写真に差し替える作業も含めて解説します。

---

## 1. 概要

`tp_clinic4_pink` は、内科・脳神経外科などを想定した病院・クリニック向けレスポンシブHTMLテンプレートです。実ファイルは **`index.html` 1つのみ**（単一ページLP構成）。旧テンプレートは複数ページ構成でしたが、本改修でトップページ内の`<section>`アンカー移動に一本化しました。

- **配色**: メインカラーは淡いピンク `#ff9999`（見出し背景、電話番号の文字色、メニュー背景、リンクのホバー色、新設した電話・LINEボタンなど全体で多用）。アクセントに `#ec6262`（メニューのホバー・現在地色、ボタンのホバー色）、フッターは濃いグレー `#444`/`#333`。CSSカスタムプロパティ（`:root { --xxx: ... }`）は**存在せず、色は `css/style.css` 内に直接16進数でハードコーディング**されています（詳細は6章）。
- **構造の特徴**: 旧テンプレートは `info.html`/`info1.html`/`info2.html`、`medical.html`/`medical1.html`/`medical2.html`のように1メニューに複数の子ページがぶら下がる構成でしたが、本改修でそれぞれ `index.html` 内の `<section id="about">`／`<section id="service">`に統合し、プルダウンメニュー（`ddmenu`）と、それを制御していた `js/ddmenu_min.js` は完全に削除しました。
- **お問い合わせ**は電話とLINEの2択のみ（`<section id="contact">`）。旧テンプレートにあった非機能サンプルフォーム（`contact.html`）とPHP自動フォーム一式（`form.html`→`confirm.html`→`finish.html`）は両方とも削除しています。
- 静的HTMLかつ単一ファイルのため、複数ファイルにまたがる共通要素の一括置換という旧テンプレート特有の手間は**もう発生しません**（電話番号・ロゴaltなど、直すのは`index.html`内の該当箇所だけでOK）。

---

## 2. ページ構成（セクション／アンカーマップ）

`index.html` は上から以下の順序で1枚に並んでいます。PC用メインメニュー（`#menubar`）とスマホ用メニュー（`#menubar-s`）はどちらも、ここに挙げるアンカー（`#about`など）へのページ内リンクです。

| セクション | `id` | 該当行(目安) | 内容 | 出典（旧ファイル） |
|---|---|---|---|---|
| ヘッダー／ナビ | - | 24〜80行目 | ロゴ、電話番号、文字サイズ切替、PC/スマホ2種のメニュー | 全ページ共通ヘッダーを踏襲 |
| ヒーロー（スライドショー） | `#mainimg`（`id`ではなくaside要素） | 68〜73行目 | CSSスライドショー（`1.jpg`/`2.jpg`/`3.jpg`） | 旧`index.html` |
| 更新情報・お知らせ | `#new` | 82〜99行目 | お知らせdlリスト（`20XX/00/00`ダミー日付×6件） | 旧`index.html` |
| 当院について | `#about` | 102〜174行目 | 「当院について」実文＋「初診の方へ」box×4＋「院長挨拶」挨拶文とテーブル | 旧`info.html`（冒頭の実コンテンツ部分のみ）＋`info1.html`＋`info2.html` |
| 診療科目 | `#service` | 176〜286行目 | 内科／脳神経外科カード、各科の説明、共通の医師出勤表 | 旧`medical.html`＋`medical1.html`＋`medical2.html`（旧`index.html`の出勤表を流用） |
| スタッフ紹介 | `#staff` | 288〜313行目 | スタッフ3名の個別紹介ボックス（`id="nihon"`/`"tokyo"`/`"okinawa"`） | 旧`staff.html`（個別ボックス型のみ採用。横並びグリッド見本は削除） |
| よくある質問 | `#faq` | 315〜341行目 | Q&A6件（`<dl class="faq">`） | 旧`faq.html` |
| アクセス | `#access` | 343〜363行目 | 所在地・地図（`dummy_map_main.jpg`）のテーブル | 旧`access.html` |
| お問い合わせ | `#contact` | 373〜381行目 | 電話ボタン＋LINEボタンの2択（新設） | 新規作成（9章参照） |
| フッター | - | 385〜438行目 | アクセス地図、受付曜日テーブル、コピーライト | 全ページ共通フッターを簡略化して踏襲 |

### 2-1. 削除したファイル（17個）

以下は全て削除済みです。これらのファイル名でリンクや画像を探しても存在しません。

`info.html` / `info1.html` / `info2.html` / `medical.html` / `medical1.html` / `medical2.html` / `staff.html` / `faq.html` / `access.html` / `contact.html` / `booklet.html` / `recruit.html` / `worklist.html` / `c1.html` / `form.html` / `confirm.html` / `finish.html`

削除理由の内訳:
- **統合**: `info.html`(実コンテンツ部分)・`info1.html`・`info2.html` → `#about`。`medical.html`・`medical1.html`・`medical2.html` → `#service`。`staff.html` → `#staff`。`faq.html` → `#faq`。`access.html` → `#access`。
- **非採用（本文ごと破棄）**: `info.html`内の「当テンプレートについて」「当テンプレートの使い方」という、テンプレート作者自身の使い方マニュアルがページ本文として埋め込まれていた部分（旧97〜301行目）。実クリニックの情報ではないため統合対象から除外。
- **単純廃止**: `booklet.html`（PDF広報誌の見本）、`recruit.html`（採用情報の空テーブル）、`worklist.html`（`index.html`と重複する医師出勤表単独ページ）、`c1.html`（1カラムレイアウトの使い方見本。ただし`<body class="c1">`というCSSクラス自体は新`index.html`で「1カラム化」に実利用しているので、クラスの存在自体はstyle.cssに残っています）。
- **フォーム関連の破棄**: `contact.html`（非機能のフォーム見本ページ、88行目に「見本ページです」と自ら明記）、`form.html`/`confirm.html`/`finish.html`（PHP自動フォーム一式）。電話・LINEのみの`#contact`セクションに置き換えたため不要。

また、次の付随ファイルも削除しています。
- **`images/sample.pdf`**: `booklet.html`からのみ参照されていたダミーPDF。`booklet.html`削除に伴い不要。
- **`js/ddmenu_min.js`**: プルダウンメニュー（`<ul class="ddmenu">`）制御用JS。ナビがフラットな1階層リストになったため不要（grep で他に参照しているファイルが無いことを確認済み）。`index.html`の`<head>`からも該当`<script>`タグを削除済みです。

`base/`フォルダ（ロゴ・スライド候補写真の未加工素材）と`_removed_images_manifest.md`は本改修の対象外のためそのまま残しています。

---

## 3. メニュー（ナビゲーション）の編集方法

### 3-1. メニューHTMLの場所

`index.html`には**メインメニューが2種類、必ずセットで存在**します。旧テンプレートと異なり、**プルダウン（`<ul class="ddmenu">`）は完全に廃止し、どちらもフラットな1階層リスト**になっています。

1. **PC用メニュー**（画面幅901px以上）: `<div class="nav-fix-pos"><nav id="menubar">...</nav></div>`（46〜58行目）。
   ```html
   <nav id="menubar">
   <ul>
   <li class="current"><a href="#">ホーム<span>Home</span></a></li>
   <li><a href="#about">当院について<span>Information</span></a></li>
   <li><a href="#service">診療科目<span>Medical</span></a></li>
   <li><a href="#staff">スタッフ紹介<span>Staff</span></a></li>
   <li><a href="#faq">よくある質問<span>Faq</span></a></li>
   <li><a href="#access">アクセス<span>Access</span></a></li>
   <li><a href="#contact">お問い合わせ<span>Contact</span></a></li>
   </ul>
   </nav>
   ```
2. **スマホ・タブレット用メニュー**（画面幅900px以下）: `<nav id="menubar-s">...</nav>`（61〜73行目）。**PC用と全く同じ7項目を、別々に記述**しています（自動生成ではありません）。**片方だけ直しても反映されないので、2箇所とも編集が必要**です。

### 3-2. メニュー項目の追加・削除・変更手順

- **項目名やリンク先を変える**: `<a href="#xxx">項目名<span>英語表記</span></a>`の日本語部分と`href`（ページ内アンカー）を書き換える。**`#menubar`と`#menubar-s`の両方**を直すこと。リンク先はページ内の`<section id="xxx">`のIDと一致させる。
- **セクションを新規追加する**: `#main`内に新しい`<section id="任意の英語ID">`を追加し、`#menubar`・`#menubar-s`双方に`<a href="#任意の英語ID">`のリンクを追加する。単一ページ構成になったため、プルダウンサブメニューという概念自体がありません。
- **「現在のページ」ハイライト**: 単一ページになったため、スクロール位置に応じて自動でハイライトが切り替わる仕組み（スクロールスパイ）は実装していません。現状は常に「ホーム」の`<li>`に`class="current"`が付いたままです（`#menubar`46行目）。CSS側は`css/style.css`の`#menubar li a:hover, #menubar li.current a { background: #ec6262; }`（185〜187行目）、`.menu li.current a`（598〜601行目、旧ページ内タブ用で現在は`index.html`側で未使用）で色が変わります。
- **メニューの列数**: `#menubar li { width: 14.28%; }`（`css/style.css` 154行目、100%÷7項目に変更済み）。項目数を変える場合はこのパーセンテージも変更が必要（例: 6項目なら16.66%）。

### 3-3. メニューの開閉・固定表示の仕組み（JS）

- **`js/ddmenu_min.js`は削除済みです**。プルダウンが無くなったため不要になりました。
- **`js/fixmenu.js`**: スクロールして`#menubar`（またはモバイル時は`#menubar-s`）の位置を過ぎたら`<body>`に`is-fixed`クラスを付与し、メニューを画面上部に固定表示させます（`css/style.css` 224行目以降の`body.is-fixed .nav-fix-pos`等に対応）。`#menubar`/`#menubar-s`というID自体は変更していないため、**このJSは無改修で動作します**。
- **`js/fixmenu_pagetop.js`**: 同様の仕組みで「↑」ページトップへ戻るボタンの表示/非表示を切り替えます。出現ポイントはコード内にハードコードされた`offsettop = 350;`（34行目）。
- **`js/openclose.js`**: 900px以下の端末で表示される「三本バー」メニュー開閉ボタン（`#menubar_hdr`）の開閉処理。`index.html`末尾（433〜438行目付近）に以下のインラインスクリプトがあり、900px以下のときだけ有効化されます。こちらも`#menubar_hdr`/`#menubar-s`というID自体は変更していないため無改修で動作します。
  ```html
  <script>
  if (OCwindowWidth() <= 900) {
      open_close("menubar_hdr", "menubar-s");
  }
  </script>
  ```

---

## 4. テキスト・コンテンツの編集箇所

`index.html`が1ファイルになったため、**旧テンプレートのように「18ファイル全部を機械的に一括置換する」必要はありません**。以下の箇所を`index.html`内で直接編集してください。

### 4-1. 共通で直すべき箇所

- **`<title>`**（6行目）: `病院・歯科医院・整体・整骨院サイト向け 無料ホームページテンプレート tp_clinic4`のまま未編集。
- **`<meta name="description">`**（8行目）: `ここにサイト説明を入れます`のまま未編集。
- **`<meta name="keywords">`**（9行目）: `キーワード１,キーワード２,...`のまま未編集。
- **h1ロゴのalt文字**: `<h1 id="logo"><a href="#"><img src="images/logo.png" alt="東京横浜サンプル医院"></a></h1>`（29行目）。ロゴのリンク先は単一ページ化に伴い`href="#"`（ページ最上部へ）に変更済み。
- **フッターロゴのalt文字＋コピーライト**: `<img src="images/logo_footer.png" alt="東京横浜サンプル医院" width="500">`と`Copyright&copy; <a href="#">東京横浜サンプル医院</a> All Rights Reserved.`（435〜436行目）。
- **電話番号 `03-0000-0000`**: ヘッダー（30行目）と、新設の電話ボタン内（378行目、`tel:0300000000`というhrefと表示テキストの両方）の**2箇所のみ**。旧テンプレートのように18ファイルに散らばっていません。フッターの電話番号表記は9-1章の判断により削除済み（ヘッダーと`#contact`セクションで十分露出しているため）。
- **受付時間 `AM9:00〜PM7:00`**（31行目、ヘッダー）、**受付曜日テーブル（月〜日の○/△/ー）**（フッター内、409〜418行目付近）、**`※8/10は診療をお休みさせて頂きます。`**（フッター内）。

### 4-2. プレースホルダーの残存箇所（本改修後に再grepで確認済み）

- **「サンプルテキスト」**: `#about`（当院について／初診の方へ／院長挨拶）、`#service`（内科／脳神経外科の説明文）、`#staff`（スタッフ紹介文）に多数残存。実データに差し替えること。
- **「20XX/00/00」**（お知らせ欄のダミー日付）: `#new`セクションに6件（88〜97行目）。
- **「ここに」で始まる入力待ちプレースホルダー**（「ここに説明を入れます」「ここに質問を書きます」等）: `#about`・`#service`・`#staff`・`#faq`・`#access`に残存。`grep -n "ここに" index.html`で全箇所を確認できます。
- **旧`info.html`の「当テンプレートについて」「当テンプレートの使い方」セクション（旧97〜301行目）は完全に削除済み**で、`index.html`には一切含まれていません。
- **旧`contact.html`の「このページはフォームの見本ページです」という開発者向け注意文も、ページごと削除済み**です。

---

## 5. 画像の差し替え方

`_removed_images_manifest.md`に記載の画像は全て`images/`フォルダから削除済みです（`booklet.html`削除に伴い`images/sample.pdf`も削除済み）。以下、それぞれの役割・元サイズ・差し替え箇所をまとめます（サイズは差し替え時の目安）。単一ページ化により「主な参照先」は基本的に`index.html`1ファイルのみです。

| ファイル名 | 役割（HTML文脈から判断） | 元サイズ(px) | 主な参照先 |
|---|---|---|---|
| `logo.png` | ヘッダー左上のロゴ（`h1#logo`内、alt="東京横浜サンプル医院"） | 1200×120 | `index.html` 29行目 |
| `logo_footer.png` | フッター中央のロゴ（`#copyright`内、width="500"指定） | 1200×120 | `index.html` 435行目 |
| `header_bg.jpg` | ヘッダー背景の装飾画像（`css/style.css` 62行目） | 1000×750 | CSSのみ（HTML側にimgタグなし） |
| `icon_tel.png` | 電話番号の受話器アイコン（背景画像、`style.css` 86/402/986/1002行目、`change.css` 35行目） | 60×56 | CSSのみ、ヘッダー・フッター電話表示 |
| `icon_menu.png` | 900px以下で出るハンバーガーメニューボタンのスプライト画像（`style.css` 904/908行目） | 100×200 | CSSのみ |
| `1.jpg` / `2.jpg` / `3.jpg` | トップのCSSスライドショー画像3枚（`#mainimg`内） | 各2000×800 | `index.html` 69〜72行目のみ |
| `sample1.jpg` | 汎用の内容紹介写真（当院について／内科の説明に添える画像） | 1000×665 | `index.html`（`#about`107行目、`#service`184/200行目） |
| `sample2.jpg` | sample1.jpgと同様の役割（脳神経外科側で使用） | 1000×665 | `index.html`（`#service`192/206行目） |
| `00000933.png` | スタッフ・院長の顔写真用プレースホルダー（正方形） | 3000×3000 | `index.html`（`#about`院長挨拶138行目、`#staff`3箇所） |
| `dummy_map_main.jpg` | アクセスマップのダミー画像 | 1641×1192 | `index.html`（`#access`本文＋フッター、計2箇所） |
| `arrow1.png` | `.list`ブロック（診療科目カード）にリンクがある場合、右下に出る矢印マーク（`style.css` 489行目） | 200×200 | CSSのみ |
| `arrow2.png` | サブメニュー矢印アイコン（`style.css` 344行目）。現在`index.html`では`#sub`サイドバーを廃止したため実際には表示箇所なし | 21×41 | CSSのみ（現在未使用） |
| `arrow3.png` | 「初診の方へ」の流れ図（`.box`と`.box`の間）に挟む下向き矢印画像 | 178×130 | `index.html`（`#about`内3箇所） |
| `faq_q.png` | FAQの質問（`dt`）の左に出る「Q」アイコン（`style.css` 614行目） | 100×100 | CSSのみ |
| `faq_a.png` | FAQの回答（`dd`）の左に出る「A」アイコン（`style.css` 622行目） | 100×100 | CSSのみ |

**削除済みで今後使わない画像**: `PDF_32.png`（`.pdf`リンクに自動で付くPDFアイコン。`booklet.html`削除により参照箇所が無くなったため、今後追加する必要はありません）。

**画像を差し替える手順のまとめ**:
1. CSSの背景画像（`header_bg.jpg`, `icon_tel.png`, `icon_menu.png`, `arrow1.png`, `arrow2.png`, `faq_q.png`, `faq_a.png`）は、同名ファイルを`images/`に置くだけでよい（HTML側の変更不要）。
2. `<img src="images/xxx">`で直接参照されている画像（ロゴ、スライド画像、写真類、`arrow3.png`, `dummy_map_main.jpg`）は、同名で置き換えるのが最も簡単。ファイル名を変える場合は上表の「主な参照先」の`index.html`内`src`属性を書き換える。
3. ロゴの土台素材（文字なし）は`base/logo.png`、`base/logo_footer.png`に、スライドショー用の土台候補写真が`base/1.jpg`・`base/2.jpg`・`base/3.jpg`として同梱されています。これらは加工・流用の元ネタとして残置していますが、公開データとしては不要です。

---

## 6. 配色・フォントサイズの調整方法

### 6-1. 色

**このテンプレートに`:root { --xxx: ... }`のようなCSSカスタムプロパティは存在しません。色は全て`css/style.css`内に16進数カラーコードとして直接ハードコーディングされています。** 配色をブランドカラーに変えるには、`css/style.css`内で該当色を検索置換する必要があります。主な箇所（本改修後の行番号）:

- **メインカラー（ピンク） `#ff9999`**: リンクホバー色（37行目）、電話番号の文字色（84行目）、メインメニューの背景色（165行目）、`#main h2`の背景（268行目）、`.list h4`の文字色（499行目）、`.box`の枠線・見出し色（532/539行目）、`.faq dt`の文字色（611行目）、`footer`の上部ボーダー（370行目）、`.color1`ユーティリティクラス（780行目付近）、**新設の`.btn-tel`背景／`.btn-line`文字色・枠線**（727/729/744/745行目付近）など、**サイト全体で非常に多数使用**。全て同じ`#ff9999`という値なので、エディタの一括置換で色調整が可能。
- **メニュー現在地/ホバー色 `#ec6262`**: 186行目、および**新設の`.btn-tel:hover`／`.btn-line:hover`背景**（732/733行目付近）。
- **本文文字色 `#333`**: body（16行目）、リンク文字色（33行目）など。
- **フッター背景 `#444`**、**コピーライト背景 `#333`**。
- **その他アクセント**: `.bgcolor1 { background: #f2f2f2 }`（出勤表の午前/午後見出し）、`.bgcolor2 { background: #dbebf7 }`（出勤表の科目見出し・薄い水色）。

**文字サイズを「大」にした際の配色**は`css/change.css`に独立して定義されており、こちらにも`#ff9999`/`#ccc`等のハードコードされた色指定があるため、メインカラーを変える場合は`change.css`側（14/19/23行目）も合わせて修正すること。

### 6-2. フォントサイズ

- **基本フォントサイズ**: `css/style.css` 18行目、`body { font-size: 16px; }`。
- **フォント種類**: 同17行目、`font-family:"ヒラギノ角ゴ Pro W3", ...`。
- **画面幅480px以下**では`#container, footer { font-size: 12px; font-size: 2.93vw; }`と可変フォントサイズに切り替わる。
- **「文字サイズを大きくする」ボタン**（ヘッダー右上、`#fsize`ブロック）を押すと`css/change.css`が適用されます。**ただしこの機能は`js/styleswitcher.js`というファイルが必要で、現在`js/`フォルダには同梱されていません**（旧テンプレートから引き継いだ未解決の問題。使う予定がなければ、`<head>`から`<link rel="alternate stylesheet" href="css/change.css" title="change">`と`<script src="js/styleswitcher.js"></script>`の2行、およびヘッダー内の`<div id="fsize">...</div>`ブロックを削除するのが安全です）。

---

## 7. その他このテンプレート特有の仕組み

- **文字サイズ切り替え機能は未完成の状態**（引き続き未解決）: `<head>`に`<script src="js/styleswitcher.js"></script>`が記述され、ヘッダーにも「文字サイズ 小/大」ボタンがありますが、**`js/styleswitcher.js`は`js/`フォルダに実在しません**。本改修のスコープ外のため触れていません。
- **FAQはJSアコーディオンではない**: `#faq`の`<dl class="faq">`は開閉ギミック無しの静止表示です。質問数が多くなる場合は開閉式に改造する余地あり。
- **トップページのスライドショーは純CSSアニメーション**: `css/slide.css`で`@keyframes slide1/slide2/slide3`により実装（JS不使用）。IE9以下向けのフォールバックとして`index.html`冒頭に`<!--[if lt IE 10]>`による`.slide1,.slide2,.slide3 {display:none;}`の条件分岐が入っています。
- **1カラムレイアウト固定**: `<body class="c1">`（26行目）を付けています。旧テンプレートでは`c1.html`がこのクラスの「使い方見本」でしたが、本改修ではサイドバー（`#sub`）自体を廃止して単一ページを縦一列で構成しているため、**このクラスを常時使う実利用**に切り替えました。`css/style.css`の`.c1 #main {float:none;width:auto}`／`.c1 #sub {display:none}`（257/314行目）がこれに対応します。`#sub`のマークアップ自体を`index.html`から削除済みなので、`.c1 #sub`のルールは実質何にも効きません（残しておいても無害です）。
- **ページ内リンク（アンカー）には`class="link"`が必須**: ヘッダーメニューが固定表示（sticky）になる関係で、単純な`id`アンカーだとメニューに文字が隠れます。`css/style.css` 797行目`.link { display: block; margin-top: -80px; padding-top: 80px; }`で相殺しています。`#staff`内の`id="nihon"`/`"tokyo"`/`"okinawa"`（いずれも`<span class="link" id="...">`）がこのクラスを使用中。新規にページ内リンクを作る際はこのクラスの付け忘れに注意。
- **スタッフの`id`アンカーは同一ページ内で共有**: `#staff`内の`id="nihon"`/`"tokyo"`/`"okinawa"`は、`#service`セクション内の医師出勤表から`href="#nihon"`等の形でリンクされています（旧テンプレートでは`staff.html#nihon`のように別ファイル参照でしたが、単一ページ化により同一ページ内アンカーに変更済み）。スタッフ名やアンカーIDを変える場合は、`#staff`内の`id`属性と`#service`内出勤表の`href`の両方を揃えて修正してください。
- **画像加工用の素材が`base/`フォルダに同梱**: `base/logo.png`・`base/logo_footer.png`（ロゴの文字なし土台）、`base/1.jpg`・`2.jpg`・`3.jpg`＋対応する`1_btn.png`等（スライドショー候補写真とボタン画像）。本改修の対象外のためそのまま残置しています。
- **`template-party.com`への配布元リンク**: 旧テンプレートのフッター・本文に多数残っていた配布元サイトへのTipsリンク（GoogleMap設置解説など）は、本改修で`#access`セクションおよびフッターから削除済みです（これらは実クリニックの情報ではなく、テンプレート編集者向けの案内だったため）。

---

## 8. （旧8章は削除済み。7章の各項目に統合しました）

---

## 9. お問い合わせセクション（電話＋LINE）について

旧テンプレートの二重お問い合わせ構成（非機能サンプルの`contact.html`＋PHP自動フォーム一式`form.html`/`confirm.html`/`finish.html`）は全廃し、`<section id="contact">`（`index.html` 373〜381行目）に電話ボタンとLINEボタンの2択のみを配置しています。

```html
<section id="contact">
<h2>お問い合わせ</h2>
<p>お電話またはLINEにてお気軽にご相談・ご予約ください。</p>
<div class="contact-buttons">
<a href="tel:0300000000" class="btn-tel"><i class="fa-solid fa-phone"></i> 電話で相談・予約する<br><span>03-0000-0000</span></a>
<a href="https://lin.ee/xxxxxxx" target="_blank" class="btn-line"><i class="fa-brands fa-line"></i> LINEで相談・予約する</a>
</div>
</section>
```

### 9-1. 編集が必要な箇所

- **電話番号**: `href="tel:0300000000"`（ハイフン無し、発信用）と、表示テキスト`<span>03-0000-0000</span>`（378行目）の**両方**を実際の電話番号に変更すること。2つの値がずれるとタップ発信時の番号と表示番号が食い違うので注意。
- **LINEリンク**: `href="https://lin.ee/xxxxxxx"`（379行目）は仮のURLです。LINE公式アカウントの友だち追加用リンク（LINE Official Account Managerで発行できる`https://lin.ee/xxxx`形式、または`https://line.me/R/ti/p/@xxxxxxx`形式）に差し替えてください。

### 9-2. Font Awesome（アイコン表示）について

このテンプレートは元々Font Awesomeを読み込んでいませんでした（`css/style.css`・全HTMLをgrepして確認済み）。電話・LINEボタンのアイコン（`<i class="fa-solid fa-phone">`／`<i class="fa-brands fa-line">`）表示のため、`index.html`の`<head>`に以下のCDN読み込みを追加しています（12行目）。

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
```

オフラインでの利用や、外部CDNに依存したくない場合は、Font Awesomeの該当ファイルをダウンロードして`css/`や`fonts/`配下に自前で配置し、パスを書き換えてください。アイコン自体が不要であれば、`<i>`タグと上記CDN行を削除し、ボタンのテキストのみで表示することも可能です。

### 9-3. ボタンのスタイル（`css/style.css`）

`.contact-buttons`／`.btn-tel`／`.btn-line`のスタイルは`css/style.css`の「お問い合わせ（電話・LINE）ボタン」ブロック（707行目付近〜）に新設しました。メインカラー`#ff9999`とホバー色`#ec6262`をそのまま使い、電話ボタンは塗りつぶし、LINEボタンはアウトライン（白背景・ピンク枠）として視覚的に区別しています。900px以下のスマホ表示では、同じセレクタに対する追加ルール（900px以下メディアクエリ内、`.contact-buttons a`）でボタンを縦積み・幅可変に切り替えています。

---

## 10. AI向け作業ログ・注意点まとめ

- 旧18ファイル構成 → `index.html` 1ファイルへの統合は完了しています。今後の追加編集は基本的に`index.html`・`css/style.css`の2ファイルだけで完結します。
- `#sub`サイドバー（受付時間表・サブメニュー）は廃止し、`<body class="c1">`により常時1カラムレイアウトにしています。復活させたい場合は`css/style.css`の`.c1`関連ルール（257/314行目）を参照しつつ、`#main`と並べる`#sub`ブロックを`index.html`に追加してください。
- スタッフ紹介の「横並びグリッド」表示パターン（旧`staff.html`後半、6件の同一プレースホルダーカード）は、個別ボックス型と重複するデモ的な内容だったため統合対象から外しています。グリッド表示に戻したい場合は`.list`クラス（診療科目カードと同じ仕組み）を流用してください。
- 医師出勤表は、旧`index.html`・`medical1.html`・`medical2.html`の3箇所に重複していたテーブルのうち、**内科・脳神経外科の両方を含む旧`index.html`版**を採用し、`#service`セクション内に1箇所だけ配置しています。
- `template-party.com`への配布元リンクは、`#access`セクションとフッターから削除済みです（実クリニック向け本番サイトとして不要な開発者向け案内のため）。
