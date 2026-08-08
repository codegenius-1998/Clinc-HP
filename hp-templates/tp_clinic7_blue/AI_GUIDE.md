# AI_GUIDE.md — tp_clinic7_blue 編集ガイド（AI向け）

このファイルは、テンプレート `tp_clinic7_blue`（Template Party 制作の歯科・医療クリニック向け無料ホームページテンプレート）を、実在するクリニックの本番サイトへ改修するための作業ガイドです。将来このディレクトリを触るAIアシスタント（または非技術者のサイト運営者）が、コードベース全体を読み直さなくても改修作業を進められるように、実際にファイルを読んで確認した内容だけを記載しています。

**このガイドは `tp_clinic7_blue`（1ページ完結のランディングページ版）専用です。** 兄弟ディレクトリ `tp_clinic7_blue_LP` は、同じ配色テーマを使った**別デザイン・別担当のランディングページ**であり、本ディレクトリとは完全に独立した別成果物です。本ガイドの内容やこのディレクトリでの作業判断を `tp_clinic7_blue_LP` に適用しないでください（逆も同様）。

---

## 1. 概要

`tp_clinic7_blue` は、歯科医院（クリニック）を想定した**1ページ完結型のランディングページ（LP）**です。以前はマルチページ構成（`index.html` / `feature.html` / `menu.html` / `greeting.html` / `staff.html` / `facility.html` の6ページ）でしたが、`feature.html`・`menu.html`・`greeting.html`・`staff.html`・`facility.html` の5ファイルはすべて `index.html` 内のセクションとして統合済みです（統合の経緯・旧ファイル構成は本ガイドの旧版の履歴を参照。現在このディレクトリに残るHTMLは `index.html` と、非公開の `_manual.html` のみです）。

- 配色は青系（プライマリカラー `#1f6bbe`、アクセントカラー `#2eb8cb` の水色）で、清潔感・信頼感を意識した医療機関らしいトーン。
- ヘッダー固定ではない通常フロー型レイアウト。ページ上部にロゴ・電話番号・予約ボタン、その下に横並びアイコンメニュー（`#menubar2`）、さらにハンバーガーで開閉するスライドメニュー（`#menubar`）を併用する二重ナビ構成（詳細は3章）。両方とも現在はすべて**同一ページ内アンカーリンク**（`#feature` 等）を指しており、別ページへは遷移しません。
- jQuery + 自作スクリプト（`js/main.js`）でハンバーガーメニュー・スムーススクロール・ドロップダウンを制御し、`js/jquery.inview_set.js` + `css/inview.css` でスクロール連動のフェードイン演出（inview）を行う。
- サンプル画像・ロゴ画像はすべて削除済み（`images/` フォルダは空）。どのファイルが何用だったかは `_removed_images_manifest.md` と本ガイド5章を参照。
- 案内文・注意書き（Template Partyの著作権表示・使用前に読む案内、「フレーム＆パーツ」販促バナー）は既にHTMLから除去済み。

---

## 2. セクション構成（アンカーマップ）

`index.html` はすべて1ファイルです。`<main>` 内に以下の `<section>`（一部は `<div id="...">` によるサブセクション）が上から順に並んでいます。ナビゲーションの `href` はすべてこれらのIDへのアンカーリンクです。

| アンカー / 場所 | 内容 | 実クリニック向けに置き換えるべきこと |
|---|---|---|
| （IDなし、`#menubar2`直後の最初の`<section>`、77行目） | お知らせ一覧（`.news`） | お知らせ本文（サンプルテキストが多数残存）、日付プレースホルダ「2000/00/00」（3件） |
| `#menu`（99行目）＋子要素 `#menu1`（138行目）/`#menu2`（175行目）/`#menu3`（204行目） | 診療メニュー。旧`index.html`の3カード紹介（`.list-cource`）と、旧`menu.html`の詳細解説（一般歯科／予防歯科／小児歯科、各`.list-yoko`）を統合。カード画像から `#menu1`〜`#menu3` へアンカーリンクするため、以前のような「詳細ページへ移動」ではなく同一ページ内スクロールになる | カード見出し・説明文、各詳細ブロックの「タイトル」「ここに説明を書きます。サンプルテキスト。」プレースホルダ、`images/landscape1〜3.jpg` の画像 |
| `#feature`（236行目） | 医院の特徴。旧`feature.html`にあった6パターンのレイアウトデモ（reverse版・shadow版・bleed版・ワイド画像版など）と、それらの使い方を説明するテンプレート解説文はすべて削除済み。**残したのは最初の素直な左画像＋右テキストパターン（`.free .list` 標準形、`image-01`/`text-01`）1つのみ**、見出し・本文はすでに実文章化されている | 見出し「安らぎと清潔感を大切にした院内環境」・本文2段落を実際の医院の特徴に書き換え。写真 `images/portrait1.jpg` を院内写真に差し替え |
| `#greeting`（265行目） | 院長挨拶＋経歴・資格年表（`.timeline`）。旧`greeting.html`の挨拶文セクションと経歴セクションを1つの`<section>`に統合（経歴側は`<h3>経歴・資格</h3>`の小見出しに変更）。指示文「※ここに挨拶文を入れて下さい。」は削除済み | 挨拶文（現状は実文章が入っているサンプル文なので、実際の院長の言葉に差し替え推奨）。`.timeline`内の「○○大学」等の伏せ字（5箇所）を実際の学歴・資格に置換。写真 `images/img-greeting.jpg` |
| `#staff`（288行目） | スタッフ紹介（`.list-staff`、3名分） | サンプル氏名（山田花子・佐藤美咲・鈴木あかり）と役職・コメントを実スタッフ情報に差し替え。人数が変わるなら`.list`ブロックごと増減。写真 `images/portrait1〜3.jpg` |
| `#facility`（321行目） | 設備紹介（`.list-kadomaru`、6枚） | 各カードの「タイトル」見出しと「ここに説明を書きます。サンプルテキスト。」本文、画像を実設備写真に差し替え（`images/landscape1〜3.jpg`を使い回し） |
| `#contact`（381行目） | **新規追加**のお問い合わせセクション（電話＋LINEボタンのみ、フォームなし）。詳細は6-3章参照 | 電話番号（`tel:0120000000` と表示テキスト）、LINEの友だち追加URL（`https://lin.ee/xxxxxxx` はダミー） |
| `<footer>`（400〜456行目） | 住所・電話・SNSアイコン・診療時間表・Googleマップ埋め込み。専用の「アクセス」セクションは設けず、既存フッターの地図がその役割を兼ねる | 住所・電話番号の実データ差し替え、Googleマップの埋め込みコードを実際の所在地のものに変更 |

旧6ファイルのうち、本番サイトに不要となった以下5ファイルは**削除済み**です：`feature.html` / `menu.html` / `greeting.html` / `staff.html` / `facility.html`。`_manual.html`（旧テンプレート制作者向け操作マニュアル、非公開扱い）は本改修の対象外のためそのまま残っています。

---

## 3. メニュー（ナビゲーション）の編集方法

このテンプレートにはナビゲーションブロックが**2箇所**あり、どちらも現在は同一ページ内アンカーへのリンクのみです（別ファイルへのリンクは一切ありません）。

### 3-1. `#menubar2`（ヘッダー直下の横並びアイコンメニュー、53〜75行目）

- `<div id="menubar2"><nav><ul>...</ul></nav></div>`。
- 各`<li><a href="#xxx">...`のリンク先はすべてページ内アンカー（`#feature` / `#menu`（子に`#menu1`〜`#menu3`）/ `#greeting` / `#staff` / `#facility` / `#contact`）。先頭に「ホーム」（`href="#"`、ページ最上部へスクロール）も追加した。
- 項目追加・削除・リネームは`<li><a href="#xxx"><i class="fa-solid fa-xxx"></i>ラベル</a></li>`を増減・編集するだけ。追加する場合は対応する`id`をセクション側にも付ける必要がある。
- 表示/非表示のブレイクポイントは**CSS側**で制御。`css/style.css` 574〜579行目付近：
  ```css
  @media screen and (max-width:900px) {
      #menubar2 { display: none; }
  }
  ```
  900px以下の画面幅で`#menubar2`ごと非表示になる（変更なし、以前と同じ）。
- ボタン風メニュー項目のスタイルは`#menubar2 li a`セレクタが担当。背景色は`var(--primary-color)`。

### 3-2. `#menubar`（ハンバーガーで開閉するスライドメニュー、465〜487行目）

- `#menubar_hdr`（ハンバーガーアイコン）と、その直後の`<div id="menubar">...</div>`。ロゴ・電話番号・予約ボタン・フルナビ（「ホーム」を含む全項目、お問い合わせも追加済み）が入っている。
- 項目追加・削除・リネームは`#menubar > nav > ul`内の`<li>`を編集。リンク先はすべて`#menubar2`と同じアンカーに統一済み。
- **`breakPoint`の扱いについて（変更しなかった、理由あり）**: 開閉のブレイクポイント変数は`js/main.js` 11行目に残っている：
  ```js
  const breakPoint = 9999;	// ここがブレイクポイント指定箇所です
  ```
  旧ガイドでは「PC画面でも常にハンバーガーが表示される」ことを指摘し、`1000`など実際のブレイクポイントへの変更を検討事項としていた。**今回のLP化では意図的にこの値を変更していない。** 理由：`js/main.js`のリサイズ処理（148〜181行目）は、`windowWidth >= breakPoint`になった際に`body`を`.large-screen`化し、`#menubar`を（ハンバーガー操作なしで）常時`.show()`する仕組みだが、`css/style.css`側の`#menubar`の位置・幅・カード状スタイル（215〜260行目付近）はすべて`.small-screen #menubar`セレクタにのみ定義されており、`.large-screen`用の対応スタイル（1341〜1343行目の`.large-screen .ws`等）は`#menubar`のレイアウトを一切カバーしていない。そのため`breakPoint`だけを下げると、PC幅で`#menubar`が「オフキャンバスの固定パネル」ではなく「無地のブロック要素としてページ内にそのまま流し込まれる」という見た目崩れが発生する。これを正しく直すには`.large-screen #menubar`用の横並びナビCSSを新規に書く必要があり、今回のLP化のスコープ（ページ統合とコンテンツ整理）を超えるため見送った。代わりに、900px超の画面では`#menubar2`（横並びアイコンナビ）が実質的な常設ナビとして機能しており、`#menubar`のハンバーガーは「予約・LINEボタンを含むフルメニューをどの画面幅でも開ける導線」として機能する、という現状の二重ナビ構成のままでも実用上は破綻しない設計になっている。**将来的にPC幅で`#menubar`を横並びナビとして常時表示したい場合は、`breakPoint`の変更とあわせて`.large-screen #menubar`用のCSSを新規に用意すること。**
- ハンバーガーメニュー内リンクのクリック時の閉じる処理・ドロップダウン開閉処理も同じ`js/main.js`に実装されている。

---

## 4. テキスト・コンテンツの編集箇所（再grep確認済み）

### 4-1. `<title>`（ページタイトル）
5行目、`<title>病院・歯科医院（クリニック）サイト向け 無料ホームページテンプレート tp_clinic7</title>`のまま。1ページ完結LPなので書き換えるのはこの1箇所のみでよい（例：「○○歯科医院｜○○市の歯医者・LP」）。

### 4-2. metaディスクリプション
7行目`<meta name="description" content="ここにサイト説明を入れます">`のまま。実際のサイト説明文に書き換える。

### 4-3. h1・ロゴalt
- `<h1>○○市の歯医者なら○○歯科医院｜痛みに配慮した歯科療法</h1>`（18行目、1箇所のみ。以前は6ページ×同一h1だったが1ページ化により自動的に1箇所に集約された。この1行の中に伏せ字「○○」が2つ含まれる）。
- 文字列「あなたのサイト名」は`grep -c`で3箇所：ロゴalt（ヘッダー19行目、`#menubar`内472行目）＋フッターcopyright表記（453行目）。実際のサイト名に統一して書き換える。
- フッターの白ロゴ（`images/logo_white.png`）のaltは`alt="SAMPLE COMPANY"`（403行目、1箇所）。表記を上記ロゴaltと統一する。

### 4-4. copyright／フッター文言
`<small>Copyright&copy; あなたのサイト名 All Rights Reserved.</small>`（453行目）を実サイト名に変更。住所`東京都XXX区XXXXビル１F`／電話`03-0000-0000`（404〜405行目）、ヘッダー・`#menubar`内の電話`0120-000-000`（24, 386, 475行目、`#contact`の`tel:0120000000`含む）はダミー値なので実データに置換。**`tel:`属性の数値部分（ハイフンなし）と表示テキストの両方を変更すること。**

### 4-5. ページ固有のプレースホルダ文言
- 「サンプルテキスト」： `grep -c "サンプルテキスト" index.html`で19件ヒット（お知らせ欄3件＋`#menu`内の各詳細ブロック・`#facility`の各カード等）。
- 日付プレースホルダ「2000/00/00」： お知らせ欄に4件（`grep -c`で確認済み）。実際のお知らせ日付・内容に差し替えるか、不要なら削除。
- 「ここに説明を書きます。」： `grep -c`で16件。`#menu`内の詳細ブロック、`#facility`の各カードに多数残存。実内容に差し替える。
- 伏せ字「○○」： `grep -o "○○" index.html | wc -l`で計7箇所（`h1`に2箇所＋`#greeting`内の`.timeline`に5箇所：学校名・学会名）。
- `#feature`の本文はすでに実文章化済み（旧`feature.html`にあった「reverseを追加すると〜」等のテンプレート機能解説文、および5つの重複デザインパターンはすべて削除した）。
- `#greeting`の「※ここに挨拶文を入れて下さい。」という指示文は削除済み（挨拶文自体は既存のサンプル文がそのまま残っているので、実際の院長の言葉に差し替えるとなお良い）。
- 各セクションに元々あった「このブロックは「.xxx」のスタイルを使用しています。cssフォルダの…」という**テンプレート編集者向けの解説文（`.list-cource`／`.list-yoko`／`.timeline`／`.list-staff`／`.list-kadomaru`について）はLP統合時にすべて削除**した。これらは本番サイトの内容ではなく制作者向けドキュメントだったため。
- `#contact`のLINE URL `https://lin.ee/xxxxxxx` はダミー値。実際のLINE公式アカウントの友だち追加リンクに差し替える。

---

## 5. 画像の差し替え方

`images/`フォルダは空です。`_removed_images_manifest.md`に削除済みファイルの一覧（ファイル名・元のピクセルサイズ・参照箇所）が記録されています。LP統合後も画像ファイル名・パスは変更していないため、以下の表がそのまま使えます（参照箇所のページ名だけ「`index.html`内の該当セクション」に読み替え）。

| ファイル名 | 役割 | 元サイズ（目安） | 現在の参照箇所（`index.html`内） |
|---|---|---|---|
| `images/logo.png` | ヘッダー左上のメインロゴ。ヘッダー＋`#menubar`内の2箇所 | 800×150 | 19, 472行目 |
| `images/logo.psd` | 上記ロゴの編集用PSD原稿（HTML非参照） | 確認不可（PSD） | なし |
| `images/logo_white.png` | フッター用の白抜きロゴ | 800×150 | 403行目 |
| `images/mainimg1.jpg` | メインビジュアル（PC〜タブレット表示用） | 2500×863（横長） | `<picture>`内`<img>` |
| `images/mainimg1_s.jpg` | 同メインビジュアルのスマホ表示用（`max-width:700px`で切替） | 1154×711 | `<picture>`内`<source srcset>` |
| `images/banner1.jpg` | 共通バナー画像。旧構成では6ページ×1枚＝6箇所あったが、LP統合により**1ページに1回だけ**（`</main>`直前）挿入する形に集約した | 2000×532（横長） | `</main>`直前1箇所のみ |
| `images/img-greeting.jpg` | `#greeting`セクションの院長写真 | 1882×851 | `#greeting`内 |
| `images/img3-1.jpg` | `#menu`の3カード紹介「一般歯科」サムネイル | 1200×675 | `#menu`内 |
| `images/img3-2.jpg` | 同「予防歯科」 | 1200×675 | `#menu`内 |
| `images/img3-3.jpg` | 同「小児歯科」 | 1200×675 | `#menu`内 |
| `images/landscape1.jpg` | 汎用横長写真。`#menu`（各`#menu1`〜`#menu3`）・`#facility`で使い回し | 1000×560 | `#menu`, `#facility` |
| `images/landscape2.jpg` | 同上2枚目 | 1000×560 | `#menu`, `#facility` |
| `images/landscape3.jpg` | 同上3枚目 | 1000×560 | `#menu`（`#menu1`のみ）, `#facility` |
| `images/portrait1.jpg` | 縦長写真。`#feature`の院内風景カットと、`#staff`の1人目（院長・山田花子）の顔写真の両方で使用 | 1000×1784 | `#feature`, `#staff` |
| `images/portrait2.jpg` | `#staff`2人目（佐藤美咲）の顔写真 | 1000×1784 | `#staff` |
| `images/portrait3.jpg` | `#staff`3人目（鈴木あかり）の顔写真 | 1000×1784 | `#staff` |
| `images/square1.jpg`〜`square3.jpg` | 正方形（1:1）写真素材。引き続き現行HTMLから参照なし（予備素材） | 1000×1000 | 参照箇所なし（未使用） |

**アスペクト比バリエーションの使い分け**（変更なし）:
- `landscape*` = 横長（診療メニュー詳細・設備紹介カット用）
- `portrait*` = 縦長（人物写真・特徴セクションの縦位置カット用）
- `square*` = 正方形（現状未使用、予備）
- `img3-*` = 横長サムネ（診療メニューカード用、16:9）
- `mainimg1*` = メインビジュアル（PC用横長／スマホ用の別トリミング）
- `banner1*` = 横長バナー（ページ末尾に1回だけ挿入）
- `logo*` = ロゴ（通常版／白版）

新しい画像を用意する際は、上表の元サイズをアスペクト比の目安として使い、同名ファイルとして`images/`フォルダに配置すれば、既存HTMLの`<img src="images/xxx.jpg">`がそのまま機能します（HTML側の書き換えは不要）。

---

## 6. 配色・フォントサイズの調整方法

### 6-1. 配色
`css/theme.css` 19〜42行目の`:root { ... }`ブロックで一括管理されています（今回のLP化では変更なし。実ファイルを再確認済み）:

```css
:root {

	--bg-color: #fff;					/*主にテンプレートの背景色*/
	--bg-border-color: rgba(0,0,0,0.2);
	--bg-inverse-color: #333;			/*上のカラーの「対」として使う色*/
	--bg-inverse-border-color: rgba(255,255,255,0.5);

	--primary-color: #1f6bbe;			/*メインカラー*/
	--primary-inverse-color: #fff;
	--primary-border-color: rgba(255,255,255,0.5);

	--light-color: #f0f7fb;			/*薄いカラー*/
	--light-inverse-color: #333;
	--light-border-color: rgba(0,0,0,0.2);

	--accent-color: #2eb8cb;			/*アクセントカラー*/
	--accent-inverse-color: #fff;
	--accent-border-color: rgba(255,255,255,0.5);

	--content-space-l: 5vw;
	--content-space-s: 2rem;

	--base-font: "Noto Sans JP", "Hiragino Kaku Gothic Pro", ... , sans-serif;
	--accent-font: "Jost";
	--serif-font: "Noto Serif JP";

}
```

サイト全体の色調を変えるにはこの`--primary-color`/`--light-color`/`--accent-color`を書き換えるだけでよい（`.btn1.primary`、`#menubar2`の背景色、`dl.news dt span`のラベル色、そして今回追加した`#contact`の電話ボタン（`--primary-color`）・LINEボタン（`--accent-color`）など多数の箇所が`var(--primary-color)`等を参照しているため一括反映される）。500px以下の画面では追加メディアクエリで`--content-space-l`が`10px`に上書きされる。

### 6-2. フォントサイズ
- 基準フォントサイズは`css/style.css`の`html`セレクタで指定：
  ```css
  html {
      font-size: clamp(12px, 0.585vw + 9.80px, 18px); /* 画面幅375px〜1400pxの間で12px〜18pxに可変 */
      overflow-x: visible;
  }
  ```
  全体のフォントサイズを底上げ／縮小したい場合はこの`clamp()`の最小値・最大値（12px / 18px）を調整する。
- フォントファミリーは`css/theme.css`の`--base-font`（本文用・Noto Sans JP）、`--accent-font`（英字装飾用・Jost）、`--serif-font`（Noto Serif JP）で管理。Google Fontsの読み込みは`css/theme.css`冒頭の`@import`で行っている。

### 6-3. `#contact`（電話＋LINEお問い合わせブロック）※今回新規追加

`index.html`の`#contact`セクション（381〜390行目）：

```html
<section id="contact">
<h2>お問い合わせ</h2>
<p>お電話またはLINEにてお気軽にご相談・ご予約ください。</p>
<div class="contact-buttons">
<a href="tel:0120000000" class="btn-tel"><i class="fa-solid fa-phone"></i> 電話で相談・予約する<br><span>0120-000-000</span></a>
<a href="https://lin.ee/xxxxxxx" target="_blank" class="btn-line"><i class="fa-brands fa-line"></i> LINEで相談・予約する</a>
</div>
</section>
```

対応するCSSは`css/style.css`の「お問い合わせ（電話＋LINEボタン）」ブロック（`.btn1.line-color a`ルールの直後、`news`ブロックの手前）に新規追加した：
- `.contact-buttons`：flexboxで2ボタンを横並び中央寄せ（狭い画面では自動的に縦積み、`flex: 1 1 280px`）。
- `.contact-buttons .btn-tel`：背景`var(--primary-color)`／文字色`var(--primary-inverse-color)`（既存の`.btn1.primary`と同じ配色ロジック）。
- `.contact-buttons .btn-line`：背景`var(--accent-color)`／文字色`var(--accent-inverse-color)`。
- Font Awesome（`fa-solid fa-phone` / `fa-brands fa-line`）はCDN経由で読み込み済み（7章参照）なので追加設定不要。

編集時の注意：
- `tel:0120000000`のようにハイフンなしの数字列にすること（表示用テキスト側は`0120-000-000`のようにハイフンありでよい）。
- LINEの`https://lin.ee/xxxxxxx`は実際のLINE公式アカウントの短縮URLに差し替える。
- ボタンの文言・アイコンを変える場合は、Font Awesome側は https://fontawesome.com/v6/search で目的のクラス名を検索して置き換え可能。

---

## 7. その他このテンプレート特有の仕組み

- **inview（スクロール連動フェードイン）**: `class="inview"`を付けた要素が画面内に入ると、`js/jquery.inview_set.js`が対応するフェード演出クラスを付与する仕組み。デフォルトの演出は同ファイル6行目`const FX_DEFAULT = 'up';`で指定（`up`/`down`/`transform1`/`transform2`/`transform3`/`blur`の6種類、実装は`css/inview.css`）。個別要素だけ演出を変えたい場合は`class="inview" data-fx="blur"`のように`data-fx`属性を追加する。演出用のCDNライブラリ`jquery.inview`本体はCDN読み込み。
- **Font Awesomeアイコン**: `css/theme.css`冒頭でCDN読み込み（v6.5.2）。`<i class="fa-solid fa-xxx">`のように直接HTMLへ記述するタイプと、CSSの疑似要素で読み込むタイプが混在。アイコンを差し替えたい場合は https://fontawesome.com/v6/search で目的のクラス名を検索して置き換える。
- **メインビジュアルの`<picture>`によるレスポンシブ切替**: `<picture><source media="(max-width: 700px)" srcset="images/mainimg1_s.jpg">...`と、画面幅700px以下でスマホ用画像に切り替える`srcset`指定を使っている。
- **2つの独立したナビ制御ロジック**: 3章で述べた通り、`#menubar2`（横並びアイコンナビ、CSS制御・900px基準）と`#menubar`（ハンバーガー開閉ナビ、JS制御・`breakPoint=9999`のまま）は別々の仕組みで、片方だけ直しても連動しない。デザイン調整時は両方確認すること。**LP化後もこの二重ナビ構成はそのまま維持している**（意図的な判断。理由は3-2章参照）。
- **スムーススクロール／`window.location.hash`対応**: `js/main.js`後半にアンカーリンク用のスムーススクロール処理があり、`#`（ページ最上部）や`#menu1`等のアンカーへスクロールする。ハッシュ付きURL（例：サイト外から`index.html#staff`のように直接リンクされた場合）で開いた際も、500ms後に該当セクションへ自動スクロールする処理が入っている（337〜343行目）。LP化で全ナビがページ内アンカーになったため、この機能が実際に使われるようになった。
- **診療時間テーブル**: フッター内`<table class="ta-week">`は月〜日の受付時間を○×△で表現する固定フォーマット。実際の診療時間に応じて記号を編集する。
- **Googleマップ埋め込み**: フッターの`<iframe src="https://www.google.com/maps/embed?...">`はダミーの座標（東京都内のどこか）。実際のクリニック所在地の埋め込みコードに差し替える必要がある。専用の「アクセス」セクションは新設していないが、このフッター内マップがアクセス情報の役割を兼ねている。
- **`template-party.com`への案内リンクが1箇所残存**: フッター内`<p><a href="https://template-party.com/file/pickup_googlemap.html">GoogleMapの地図を変更する方法はマニュアルをご覧下さい。</a></p>`（449行目）。Googleマップの差し替えが完了したら、この案内文ごと削除して問題ない（本改修のスコープ外のため未着手）。

---

## 8. 削除済み・整理済みファイル

以下はLPへの統合作業で**実際に削除済み**です（旧ガイドでは削除候補として案内していたが、今回の作業で実行した）：

1. `feature.html` — 内容は`index.html`の`#feature`セクションへ統合（6パターンのデザインデモのうち1パターンのみ採用、他5パターンとテンプレート解説文は破棄）。
2. `menu.html` — 内容は`index.html`の`#menu`セクション（`#menu1`〜`#menu3`）へ統合。「詳細はこちらへ」の別ページ遷移パターンは廃止し、同一ページ内アンカーに変更。
3. `greeting.html` — 内容は`index.html`の`#greeting`セクションへ統合。指示文「※ここに挨拶文を入れて下さい。」は削除。
4. `staff.html` — 内容は`index.html`の`#staff`セクションへ統合。
5. `facility.html` — 内容は`index.html`の`#facility`セクションへ統合。

残っているファイル（削除しなかったもの、本改修の対象外）：
- `_manual.html` — 旧テンプレート制作者向け操作マニュアル。非公開扱いのため今回は触れていない。
- `_removed_images_manifest.md` — 画像復元用の内部管理メモ。全画像の差し替えが完了し不要になった時点で削除してよい。

`index.html`内、および`css/`・`js/`配下に、削除した5ファイルへの`href`参照が残っていないことは`grep`で確認済み（`_manual.html`内には旧リンクがそのまま残っているが、非公開ファイルのため対象外）。

---

以上。編集時は、まず2章のセクション構成表で対象箇所を特定し、4章でテキスト差し替え箇所、5章で画像差し替え箇所、3章でナビ構造を確認しながら作業を進めてください。
