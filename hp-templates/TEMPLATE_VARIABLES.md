# クリニックサイトのAI生成方式 — 仕様書

**2026年8月改訂: アーキテクチャを全面刷新しました。** 以前の版（静的HTMLテンプレートをコピーし、AIには空欄に入れる値だけを生成させる方式）はこのバージョンでは廃止されています。本書は現行の「OpenAIがページ内容を一から作成し、コードがHTML/CSSに組み立てる」方式について説明します。`hp-templates/template0001/` および `hp-temp/` 以下の各ディレクトリは、実行時にはもう読み込まれません。デザインプリセット（配色・雰囲気）の抽出元として保存してあるだけの参考資料です。

## 全体の流れ

```
ヒアリングシート ─┐
                  ├─▶ generateContentPlan()  ──▶ ContentPlan（JSON, zod検証）
SITE_SPEC.json ────┤        [OpenAI structured output 1回]
デザインプリセット ─┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
matchImagesToCategories  generateSiteImage    renderSiteHtml
（アップロード写真の       （残りの画像を         （Reactコンポーネントで
 カテゴリ照合・流用）        AI生成）               HTML/CSSを機械的に組立）
        └─────────────────────┴─────────────────────┘
                              ▼
                public/generated/<slug>/ に書き出し
```

実装は `src/lib/siteGenerator.ts` の `generateSite(hearing)` が中心。

- **AIが決める（医院ごとに変わる）**: 診療科案内・ご挨拶・特徴・施設案内の見出し／本文、TOPページの見出し文言、SEO（title/meta description/OGP）、画像ごとの生成プロンプト、（実データが無い場合の）お知らせ・FAQの件数と内容。
- **`hp-templates/SITE_SPEC.json`（固定・全医院共通）が決める**: どのセクションが存在するか（必須13種＋任意のスタッフ紹介）、各セクションに何のヒアリング項目が紐づくか、事実（電話・住所・診療時間・料金）は絶対にAIが創作しないという制約、ナビ・フッターメニューの自動生成ルール。
- **ユーザーがヒアリング画面で決める**: デザインプリセット（配色・雰囲気）選択、セクションの表示/非表示・並び順、スタッフ／FAQ／お知らせ／料金表の実データ。

## `hp-templates/SITE_SPEC.json` — 必須仕様の正本

読み込み・型検証は `src/lib/siteSpec.ts`（zodスキーマ）。

- `structuralSections`: ヘッダ・TOPページ・フッター。常に存在し、並び替え・非表示の対象外。
- `sections[]`: 本文の11セクション（診療科案内・ご挨拶・特徴・施設案内・診療時間・アクセス・お知らせ・スタッフ紹介・よくある質問・料金表・お問い合わせ）。各要素の主なフィールド:
  - `order` / `removable` / `defaultVisible`: ヒアリング画面の並び替えUI（`SectionOrderEditor`）の初期状態。
  - `content.aiAuthored`: `false` の場合、AIには一切渡さずヒアリングシートの値からコードが直接組み立てる（`hours`/`access`/`contact`）。それ以外（`department`/`greeting`/`features`/`facility`）はAIが見出し・本文・画像プロンプトを作成する。
  - `content.hideIfEmpty`: ヒアリングに実データが無ければ、ユーザーが表示ONにしていても最終的に非表示にする。
  - `repeatable`: `news`/`staff`/`faq`/`pricing` が該当。`source`（ヒアリングのどの配列項目か）・`fallback`（`"ai"`＝実データが無ければAIが生成してよい／`"hide"`＝AIは創作せず非表示にする）・`min`/`max`。
- `reservation`: 予約導線は電話・LINEのみ。Web予約フォームは生成しない。
- `seo` / `nav` / `branding` / `imageStyleRules` / `honestyRules`: 後述。

## セクションの表示/非表示・並び順

ヒアリング画面の `SectionOrderEditor`（`src/components/create/SectionOrderEditor.tsx`）で、ユーザーが各セクションのチェックボックス（表示/非表示）とドラッグ＆ドロップ／上下ボタン（並び順）を直接操作する。送信時に `sectionId`/`sectionVisible`/`sectionOrder` の3つの並列hidden inputとして送られ、`actions.ts` が `HearingSheet.sectionPrefs` にまとめる。

`siteGenerator.ts` の `resolveSections()` が最終的な表示可否を決定する:

1. `sectionPrefs` があればそれを使う（無ければ `SITE_SPEC.json` の `defaultVisible`/`order`）。
2. その上で、`hours`/`access`/`staff`/`pricing` は対応するヒアリング項目が空なら強制的に非表示にする（ユーザーがONにしていても、実データが無ければ表示しない＝金額や診療時間の創作を防ぐ最終防波堤）。

可視セクション一覧はそのままヘッダーナビ（`Nav`）・フッターメニュー（`Footer`）の生成にも使われる。AIも手動同期も不要— 表示中のセクションと完全に一致することがコード上保証されている。

## `ContentPlan`（AIの出力）

`src/lib/openai/generateContentPlan.ts` が1回のstructured output呼び出しで生成する（`generateSiteCopy`と`planGeneration`を統合した後継）。**HTMLタグは一切含まれない。** 主な形:

```ts
type ContentPlan = {
  seo: { title, metaDescription, ogTitle, ogDescription, ogSiteName };
  hero: { headline, subheadline };
  sections: {
    [sectionId: string]: { heading: string; body: string; blocks: { heading: string; body: string }[] };
  };
  images: { sectionId; blockIndex?: number; role: "logo"|"photo"|"icon"; prompt; alt; aspect }[];
  newsFallback: { date; title }[];  // hearing.newsが空の場合のみ使用
  faqFallback: { question; answer }[]; // hearing.faqsが空の場合のみ使用
};
```

`sections` のキーは、その時点で可視かつ `content.aiAuthored !== false` のセクションIDのみ（非表示のセクションや `hours`/`access`/`contact` はそもそもAIに渡さない）。

## 画像の生成

- `images[]` の各エントリが「このセクション（またはそのカードの何番目）にどんな画像が要るか」をAIが決める。`siteGenerator.ts` の `buildImageJobs()` がこれを実ファイルパス（`images/{sectionId}.jpg` または `images/{sectionId}-{blockIndex}.jpg`）に変換する。ヘッダーのロゴ（`images/logo.png`）とTOPページのヒーロー画像（`images/hero.jpg`）はAIが省略しても必ず生成される。
- `aspect`（`"1:1"`/`"4:3"`/`"16:9"`/`"2:1"`）は `ASPECT_SIZE` テーブルで実ピクセルサイズに変換され、`generateSiteImage`（既存実装を流用）に渡される。ロゴは常に128×128・透明PNG。
- アップロード写真とのマッチングは `matchImagesToCategories`（既存実装を流用）。ロゴは対象外（常にAI生成）。ふさわしい候補が無ければAI生成にフォールバックする。
- スタッフ写真はAIのコンテンツプランに含まれない（`staff` は非AI・実データのみのセクションのため）。`hearing.staffMembers[].photoUrl` があればそれを使用、無ければ人物写真として個別にAI生成する。
- `hp-templates/SITE_SPEC.json` の `imageStyleRules`（白余白を作らない・文字を入れない等）と `branding.logo`（医療モチーフのみ・医院名の文字は入れない）は、`generateContentPlan` のシステムプロンプトにそのまま埋め込まれる。

## お知らせ・FAQ・料金表・診療時間（件数と内容の可変ルール）

| セクション | 実データがある場合 | 無い場合 |
|---|---|---|
| お知らせ (`news`) | `hearing.news` をそのまま使用（件数・内容とも） | `ContentPlan.newsFallback`（AIが2〜6件生成） |
| よくある質問 (`faq`) | `hearing.faqs` をそのまま使用 | `ContentPlan.faqFallback`（AIが2〜6件生成） |
| 料金表 (`pricing`) | `hearing.priceItems` をそのまま使用 | セクションごと非表示（AIは金額を創作しない） |
| 診療時間 (`hours`) | `hearing.hours`（改行区切り）を1行ずつ「ラベル：値」に分解して表示 | セクションごと非表示（AIは診療時間を創作しない） |
| スタッフ紹介 (`staff`) | `hearing.staffMembers` をそのまま使用 | セクションごと非表示（デフォルトも非表示） |

いずれも件数の上限・下限は「実データの件数をAI生成用の最小値まで水増ししない」（`hoursRowsFromHearing`/`resolveSections` はヒアリング実データをそのまま使い、AIのmin/maxはAIが自分で件数を決めるときにのみ適用される）。

## SEO・カラーテーマ・ヘッダー/フッターのリンク

- **SEO**: `ContentPlan.seo` の5項目（title/meta description/og:title/og:description/og:site_name）を毎回AIが医院名・診療科・特徴から作成し、`<head>` に直接出力する（`src/lib/render/components.tsx` の `SitePage`）。
- **カラーテーマ**: デザインプリセット（`hp-templates/presets/*.json`）が2〜5色のカラーテーマ候補（`colorThemes`）を持ち、ユーザーがヒアリング画面で1つ選ぶ。選ばれたトークン（primary/accent/light）は生成時に `<html style="--primary:...">` として直接埋め込まれる（実行時の切り替えは無く、1サイト＝1配色で確定生成）。
- **フォント・角丸**: プリセットの `fontFamily`（sans/serif）・`cardStyle`（rounded/sharp）が `--font`/`--radius` に反映される。
- **ヘッダー**: ロゴ（AI生成）＋医院名（`hearing.clinicName` そのまま）＋電話番号（`hearing.phone` そのまま）。
- **ナビ・フッターメニュー**: 可視セクション一覧（表示順そのまま）から機械的に生成（前述）。
- **予約リンク**: 電話（`tel:`）・LINE（`https://line.me/R/ti/p/@ID`）のみ。番号・LINE IDが無い方のボタンだけ非表示。Web予約は実装しない。

## デザインプリセット（`hp-templates/presets/*.json`）

読み込みは `src/lib/designPresets.ts`。1ファイル1プリセット。

```json
{
  "id": "clinic-standard",
  "label": "スタンダード",
  "notes": "...",
  "colorThemes": [{ "id": "skyblue", "label": "スカイブルー", "tokens": { "primary": "#4ba3fc", "accent": "#2d7dd2", "light": "#e8f4ff" } }],
  "defaultColorTheme": "skyblue",
  "fontFamily": "sans",
  "cardStyle": "rounded",
  "mood": "コピー生成AIに渡す文章トーンの指示"
}
```

現在4種類（`clinic-standard`／`clinic-pink-warm`／`clinic-navy-premium`／`clinic-fresh-green`）。それぞれ `hp-templates/template0001` や `hp-temp/tp_*` の配色・雰囲気を要約したもの。追加する場合は同じ形式のJSONを `hp-templates/presets/` に置くだけでよい（コード変更不要）。

## レンダリング（`src/lib/render/`）

- `types.ts`: `SiteViewModel`（表示直前の完全に確定した状態。テキスト・画像パス・表示順すべて解決済み）。
- `components.tsx`: セクションごとのReactコンポーネント（`Header`/`Hero`/`AiSection`/`HoursSection`/`AccessSection`/`NewsSection`/`StaffSection`/`FaqSection`/`PricingSection`/`ContactSection`/`Footer`）と、それらを束ねる `SitePage`。
- `renderSiteHtml.ts`: `react-dom/server` の `renderToStaticMarkup` でHTML文字列化するだけの薄いラッパー。
- `site.css`: 全生成サイト共通のスタイルシート（CSSカスタムプロパティで配色/フォント/角丸を切替）。JS依存（jQuery・カルーセル等）は排除し、FAQは全件展開表示、モバイルメニューはCSSのみのチェックボックス開閉。
