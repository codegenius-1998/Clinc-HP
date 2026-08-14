# hp-templates — 索引

このディレクトリは、クリニックサイトを自動生成するための**データ**（デザインプリセット・配色・必須セクション仕様）だけを置く場所です。HTML/CSS/JSの完成品テンプレートは置いていません。

## ファイル一覧

| ファイル | 役割 | 読み込み元 |
|---|---|---|
| [`SITE_SPEC.json`](SITE_SPEC.json) | 全クリニック共通の必須セクション構成・生成ルールの正本（診療科案内・ご挨拶・診療時間など13セクション、正直性ルールなど） | `src/lib/siteSpec.ts` |
| [`colors.json`](colors.json) | サイト全体の配色パレット（primary/accent/light の7色セット） | `src/lib/designPresets.ts` `listColorPalette()` |
| [`presets/*.json`](presets/) | デザインプリセット（雰囲気・フォント・カード形状・レイアウト構造）。1ファイル1プリセット、色は持たない | `src/lib/designPresets.ts` `listDesignPresets()` |
| [`TEMPLATE_VARIABLES.md`](TEMPLATE_VARIABLES.md) | 現在のサイト生成アーキテクチャ（ヒアリング→AI生成→HTML組み立て）の仕様書。ファイル名は初期の実装（テンプレートの変数化）の名残だが、内容は最新 | ドキュメントのみ（コードからは読まれない） |
| [`NEXTJS_TAILWIND_GSAP_GUIDE.md`](NEXTJS_TAILWIND_GSAP_GUIDE.md) | 生成後のクリニックサイトを Next.js＋Tailwind＋GSAP で実装する場合の具体的な手順書 | ドキュメントのみ |

## デザインプリセット一覧

`presets/` 配下の9本は、実在するHTMLテンプレートから抽出した「雰囲気・レイアウト構造の指示書」であり、対応するHTML実体はもう存在しません（下記「2026年8月の整理」参照）。

| id | label | fontFamily/cardStyle/heroLayout/blockLayout/spacing |
|---|---|---|
| template0001 | クリニック | sans/rounded/full-bleed/grid/compact |
| template0002 | 初心者向けクリニック | sans/rounded/full-bleed/grid/compact |
| template0003 | クリニック（旧世代ピンク） | sans/rounded/split/grid/spacious |
| template0004 | クリニック（装飾多めピンク） | sans/rounded/split/list/spacious |
| template0005 | クリニック（ブルー・LP統合版） | sans/rounded/full-bleed/grid/compact |
| template0006 | クリニック（ブルー・純LP） | sans/sharp/split/list/compact |
| template0007 | クリニックLP（スライド主体） | sans/rounded/full-bleed/minimal/spacious |
| template0008 | ホーム・介護施設（医療転用可） | serif/rounded/full-bleed/minimal/spacious |
| template0009 | 整骨院（ネイビー） | serif/sharp/split/list/compact |

各フィールドの意味は [`TEMPLATE_VARIABLES.md`](TEMPLATE_VARIABLES.md) の「カラーパレットとデザインプリセット」章を参照。プリセットを追加する場合は、この形式のJSONを `presets/` に置くだけでよい（コード変更不要、対応するHTML実体を用意する必要もない）。

## 実際の生成の仕組み

ヒアリングシートの内容と上記のデータを元に、OpenAIがページの見出し・本文・画像を1から生成し、`src/lib/render/`（Reactコンポーネント＋`site.css`＋`main.js`）が素のHTML/CSS/JSとして機械的に組み立てる。詳細は [`TEMPLATE_VARIABLES.md`](TEMPLATE_VARIABLES.md)。

**サイト運営者側は最終的な実装をNext.js＋Tailwind CSS＋GSAPで作る想定**のため、上記の素のHTML/CSS/JS出力をそのまま公開するのではなく、[`NEXTJS_TAILWIND_GSAP_GUIDE.md`](NEXTJS_TAILWIND_GSAP_GUIDE.md) の手順で作り直すことを前提にしている。

## 2026年8月の整理

以前はこのディレクトリに、無料HTMLテンプレート配布サイト「Template Party」由来の完成品テンプレート（`template0001`〜`template0006`、index.html＋css＋js＋images一式）を、デザインプリセットの抽出元の参考資料として保存していた。これらはコードから一切読み込まれておらず（`presets/*.json` を作成した時点で用済み）、サイト運営者の実装方針（Next.js＋Tailwind＋GSAP、素のHTML/CSS/JSは不使用）とも合わないため削除した。抽出済みの `presets/*.json` と `colors.json` はそのまま有効。
