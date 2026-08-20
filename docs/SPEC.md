# Clinc-HP システム仕様書

**版数** 2.0（確定版）／ **作成日** 2026-08-19 ／ **対象** `main` 作業ツリー（未コミット変更を含む）

> **v1.0 からの変更**：v1.0 はプロジェクトへのアクセス不能下でセッション記録から再構成したため、一部が推定でした。本版は**全モジュールを実ソースで照合済み**です。推定マーク（🔶）は撤廃しました。主な訂正は 13章にまとめてあります。

---

## 1. プロダクト概要

### 1.1 一言でいうと

> クリニックがヒアリングシートを提出すると、AI がデザインテンプレートを自動選択し、文章と写真を生成して静的サイトを組み立て、そのままブラウザ上で編集・公開できる CMS。

### 1.2 設計の中心思想

**「テンプレート」と「生成されたサイト」は同一のデータ構造（`SiteDocument`）である。** 両者の違いは `sites.is_template` フラグ 1 つだけ。

ソース（`src/lib/site/document.ts`）のコメントが意図を明記しています。

> その同一性は意図的かつ構造を支えるものである。1 つのレンダラーが両方を出力し（テンプレートのプレビューは、そこから生まれるサイトとピクセル単位で一致する）、1 つの編集画面が両方を編集し、「テンプレートからサイトを作る」が別のコードパスではなく単なる複製＋内容差し替えになる。

もう 1 つの柱が **AI 呼び出しの分離**です。`renderSiteFiles()` は AI を一切呼ばず、画像ファイルにも触れません。したがって**編集の保存は即座に完了し、API 料金がゼロ**です。

---

## 2. 用語定義

| 用語 | 定義 |
|---|---|
| ヒアリングシート | クリニックが入力する基本情報。生成の「最初の材料」 |
| SiteDocument | サイト／テンプレートの設計図。**生成後はこれが唯一の正** |
| DesignTokens | 見た目のすべてを数値で保持。そのまま CSS カスタムプロパティになる |
| ブロック（Block） | ページの構成単位。**種類は固定 12 種**、個数と順番は自由 |
| テンプレート | `isTemplate = true` の SiteDocument |
| 販売可（canSell） | テンプレートを自動選択の候補に含めるフラグ |
| 申請 | クリニックオーナーが提出したヒアリングシート。管理者の承認で生成が走る |

---

## 3. ロールと権限

| ロール | ログイン | できること |
|---|---|---|
| クリニックオーナー `clinic_owner` | `/` | 申請の作成・削除、自分のサイトの閲覧・編集・公開 |
| 管理者 `admin` | `/admin` | 申請の承認・生成、全サイトの編集、テンプレートの作成・編集・販売可設定、マスタデータ管理、ユーザー管理 |

ログイン画面もセッションも完全に別系統です。ログイン時はメール・パスワードに加え**ロールも照合**します（`WHERE email = ? AND role = ?`）。

### 3.1 権限モデル（`src/lib/site/access.ts`）

```
管理者            → すべて編集可
clinic_owner      → 自分が owner_email のサイトのみ編集可
                    テンプレートは編集不可（「テンプレートを編集できるのは管理者のみです。」）
未ログイン        → 拒否（「ログインしてください。」）
```

テンプレートが管理者専用である理由もソースに明記されています。テンプレートは共有インフラであり、1 つのクリニックがそれを編集すると、以後そこから生成されるすべてのサイトが黙って変わってしまうためです。

### 3.2 実装上の絶対規則

> **Server Action は直接 POST 可能なエンドポイントである。したがってページ側のガードは何も守らない。**

このため、

- 管理系 Server Action は先頭で `requireAdmin()` を呼ぶ（`contentActions.ts` / `templateActions.ts` の全関数で実施を確認）
- 編集系 Server Action は先頭で `requireEditableDocument(id)` / `requireEditableDocumentBySlug(slug)` を呼ぶ（読み込みと権限チェックを 1 ステップで行う）

さらに `saveDocumentAction` は、**クライアントから来たペイロードのうち編集可能な範囲だけを採用**し、`id` / `slug` / `isTemplate` / `canSell` / `templateId` / `ownerEmail` / `createdAt` は保存済みの行から読み直します。改竄されたペイロードで所有者を移したり、自分をテンプレートに昇格させたり、別ドキュメントを上書きしたりできません。

---

## 4. システム構成

### 4.1 技術スタック

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Next.js 16.3.0（App Router、Server Actions 中心） |
| UI | React 19.2.8 |
| 言語 | TypeScript 5 |
| 管理画面スタイル | Tailwind CSS v4 |
| 生成サイトスタイル | 素の CSS ＋ CSS カスタムプロパティ |
| バリデーション | zod 4.4.3 |
| HTML/CSS 解析 | cheerio 1.2.0 ＋ 正規表現 |
| DB | Cloudflare D1（**HTTP REST API 経由**、Workers バインディングではない） |
| 画像ストレージ | Supabase Storage（**Storage REST API 経由**、`@supabase/supabase-js` は使わない） |
| AI（文章・判断） | OpenAI `gpt-5.6-terra`（`responses.parse` ＋ `zodTextFormat`） |
| AI（画像） | OpenAI `gpt-image-2` / `gpt-image-1` |
| 公開先 | Cloudflare Pages（`npx wrangler pages deploy`） |

**依存は意図的に最小限**です。ドラッグ&ドロップも当初案の `@dnd-kit` を採らず、HTML5 標準 API で実装しています（依存追加ゼロ）。

### 4.2 環境変数（`.env.local`）

```
OPENAI_API_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   （任意：anon ロールに INSERT ポリシーが無い場合のみ）
SUPABASE_STORAGE_BUCKET     （任意：既定 "site-images"）
```

### 4.3 データの所在

| データ | 保存先 |
|---|---|
| ユーザー・セッション | D1 `users` / `sessions` |
| マスタデータ（診療科・サービス・特徴・ターゲット・セクション） | D1 |
| SiteDocument（テンプレート／サイト） | D1 `sites` / `site_sections` |
| ヒアリングシート | **ローカルファイル** `data/hearings/<slug>.json` |
| 生成サイト | **ローカルファイル** `public/generated/<slug>/` |
| テンプレートのプレビュー | `public/generated/_templates/<id>/` |
| ユーザーアップロード写真 | Supabase Storage → 生成サイト内へ複製 |

---

## 5. データモデル

### 5.1 D1 スキーマ

#### 認証系（`0001_create_auth_tables.sql`）

```sql
users(id PK, email UNIQUE, password_hash, password_salt,
      role CHECK IN ('admin','clinic_owner'), created_at)
sessions(token PK, user_id FK→users ON DELETE CASCADE, role, expires_at, created_at)
```

- パスワード：`scrypt`（ソルト 16 バイト／鍵長 64 バイト）、照合は `timingSafeEqual`
- セッション：32 バイト乱数、TTL **7 日**
- Cookie `session_token`：`httpOnly` / `sameSite=lax` / 本番のみ `secure`

#### コンテンツ系（`0002_create_content_tables.sql`）

```sql
sections(id PK, name)                                    -- ブロック種別マスタ
sites(id PK, name, is_template, can_sell, created_at)
site_sections(id PK, sec_id FK→sections, site_id FK→sites, content, position)
departments(id PK, name)
services(id PK, department_id FK→departments, name)
features(id PK, name)
targets(id PK, name)
```

#### SiteDocument 対応（`0003_site_documents.sql`）

**新テーブルを作らず既存テーブルを拡張**しています。`sites.is_template` も `site_sections.position` も元々この用途に適した形でした。

```sql
ALTER TABLE sites ADD COLUMN slug / owner_email / template_id / design / meta
                                 / mood / tags / source_url / thumbnail_url / updated_at;
CREATE UNIQUE INDEX idx_sites_slug        ON sites(slug);
CREATE INDEX        idx_sites_owner_email ON sites(owner_email);
CREATE INDEX        idx_sites_template_id ON sites(template_id);

ALTER TABLE site_sections ADD COLUMN visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE site_sections ADD COLUMN nav_label TEXT;

-- 12 種のブロック種別を sections に投入（FK 解決と管理画面表示のため）
INSERT OR IGNORE INTO sections (id, name) VALUES ('hero','メインビジュアル'); …他11種
```

#### ブロックの格納方式（`src/lib/site/store.ts`）

```
site_sections.id       → "<siteId>:<block.id>"   ← サイトIDで名前空間化
site_sections.sec_id   → block.type              ← 固定カタログの1つ
site_sections.content  → block.data (JSON)
site_sections.position → 配列インデックス
```

**名前空間化の理由**：ブロック ID はドキュメント内で一意であればよく、テンプレートは意図的に読みやすい ID（`hero`、`department`）を使います。これらは HTML アンカーになるためです。一方 `site_sections.id` はグローバル主キーなので、`hero` を含む 2 つ目のテンプレートが insert に失敗します。接頭辞なしの値はそのまま通すため、名前空間化以前の行も読めます。

### 5.2 SiteDocument（`src/lib/site/document.ts`）

zod スキーマで全体を検証します。

```ts
type SiteDocument = {
  id: string;
  slug: string;          // public/generated の出力先名 兼 Cloudflare Pages プロジェクト名。ASCII のみ
  name: string;
  isTemplate: boolean;   // ← テンプレートとサイトの唯一の違い
  canSell: boolean;      // テンプレート専用：自動選択に出すか
  templateId?: string;
  ownerEmail?: string;
  design: DesignTokens;
  meta: SiteMeta;
  blocks: Block[];       // 配列順 = 表示順
  mood?: string;         // テンプレート専用：雰囲気の散文
  tags: string[];
  sourceUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type SiteMeta = {
  clinicName; phone; line; address; logoImage;
  seo: { title; metaDescription; ogTitle; ogDescription; ogSiteName };
  snsLinks: { label; href }[];
};
```

`navBlocks(doc)` が「表示中かつ `navLabel` が空でない」ブロックを文書順で返します。**ページの `<nav>` とフッターのリンク一覧は両方ともこの関数から導出される**ため、両者が食い違うことは原理的にありません。

### 5.3 DesignTokens

旧方式（`fontFamily: "sans" | "serif"` のような 2 択）を廃し、実値を保持します。zod で**範囲まで拘束**されている点が重要です。

| グループ | フィールド | 型・範囲 |
|---|---|---|
| `colors` | `primary` `accent` `light` `background` `text` `primaryInverse` `accentInverse` | `#rgb` / `#rrggbb` |
| `font` | `headingFamily` `bodyFamily` | 非空文字列 |
| | `googleFonts` | `string[]`（例 `"Noto Sans JP:wght@400;700"`。空＝外部リクエストなし） |
| | `baseSize` | 12〜22 |
| | `lineHeight` | 1.2〜2.4 |
| | `headingWeight` | 整数 300〜900 |
| `block` | `radius` | 0〜48 |
| | `borderWidth` | 0〜4 |
| | `borderColor` | hex |
| | `shadow` | `none` \| `soft` \| `strong` |
| | `cardLayout` | `grid` \| `list` \| `minimal` \| `overlap` |
| `layout` | `heroLayout` | `full-bleed` \| `split` \| `centered` |
| | `maxWidth` | 880〜1440 |
| | `spacingScale` | 0.7〜2 |
| | `sectionDivider` | `none` \| `wave` \| `diagonal` |
| `animation` | `reveal` | `none` \| `fade` \| `slide-up` \| `zoom` |
| | `duration` | 0〜2000（ms） |
| | `stagger` `parallaxHero` | boolean |

`cardLayout` は**テンプレートが持つ最大の構造的レバー**です。`"minimal"` はカード画像をまったく描画しないため、**画像生成側がこれを参照する必要があります**（CSS 任せにすると、どの `<img>` も指さないファイルに画像生成 API 料金を払うことになる）。

`primaryInverse` / `accentInverse` を計算ではなく明示値として持つのは、取り込み元サイトが実際に何をしていたかを尊重するためです。

`DEFAULT_DESIGN_TOKENS` は `site.css` の `:root` フォールバックと一致しており、URL 取り込みが値を決められなかったときと、手作りテンプレートの出発点に使われます。

### 5.4 ブロック（12 種の固定カタログ）

```ts
type Block = {
  id: string;        // "blk_<random6><time3>" — HTMLアンカーになるため短い
  type: BlockType;   // 12種
  visible: boolean;
  navLabel: string;  // 空文字 = 描画するがナビには出さない（hero・バナー）
  data: …;           // type ごとの zod スキーマ（discriminated union）
};
```

**種類ごとに data スキーマが異なる判別可能ユニオン**です。各ブロックが**固有のインスタンス ID を持つ**ことが、同じ種類を複数配置できる理由です（旧 `SITE_SPEC` は種別 ID をキーにしていたため各 1 個が上限でした）。

| type | 日本語名 | 単一 | 既定 navLabel | data の主フィールド |
|---|---|:---:|---|---|
| `hero` | メインビジュアル | ✔ | （なし） | headline / subheadline / image |
| `rich` | 文章＋カード | | セクション | heading / body / image? / cards[]{heading,body,image?} |
| `hours` | 診療時間 | | 診療時間 | heading / rows[]{label,value} / note? |
| `access` | アクセス | | アクセス | heading / address / mapQuery / note? |
| `news` | お知らせ | | お知らせ | heading / items[]{date,title,body?} |
| `staff` | スタッフ紹介 | | スタッフ紹介 | heading / members[]{name,role?,comment,image?} |
| `faq` | よくある質問 | | よくある質問 | heading / items[]{question,answer} |
| `pricing` | 料金表 | | 料金表 | heading / items[]{name,price,note?} / note? |
| `contact` | お問い合わせ | ✔ | お問い合わせ | heading / lead（番号は「基本情報」から取得） |
| `freeText` | 自由文 | | （なし） | heading / body / align(left\|center) |
| `imageBanner` | 画像バナー | | （なし） | image / caption? / href? / height(short\|tall) |
| `gallery` | 写真ギャラリー | | ギャラリー | heading / images[]{src,caption?} / columns(2\|3\|4) |

`rich` は**診療科案内・ご挨拶・当院の特徴・施設案内をすべて兼ねます**。区別するのは `navLabel` と `heading` だけであり、これがそのまま文章生成 AI への指示になります。**管理者がテンプレートに 5 つ目の内容セクションを足すと、コード変更なしに AI が文章を書きます。**

#### ブロックレジストリ（`src/lib/site/blocks.ts`）

`BLOCK_DEFINITIONS` が**レンダラーと編集フォームを駆動する唯一の設計図**です。`BlockEditor.tsx` がこの `fields` を歩いてフォームを組み立てるため、**フィールド追加はこの 1 箇所の編集で完結**します。

このモジュールは**意図的に React を含みません**。編集画面はクライアントコンポーネントなので、ここにレンダリング用コンポーネントを引き込むとレンダラー全体がブラウザバンドルに入ってしまいます。type → コンポーネントの対応は `src/lib/render/components.tsx` 側にあり、**両者は `BlockType` を網羅的に switch することで同期**しています。

フィールド種別は 6 つ：

| 種別 | 用途 |
|---|---|
| `text` / `textarea` | 単一行・複数行テキスト |
| `image` | 画像（`adoptImageAction` 経由） |
| `url` | リンク先 |
| `select` | 選択肢。`numeric: true` で数値として書き戻す |
| `list` | 繰り返し（カード・FAQ・スタッフ等）。`itemLabel` `newItem()` `max?` を持つ |

`blockSummary()` が編集画面のブロック一覧に短い要約を出すため、`rich` が 4 つあっても同じ行が 4 つ並びません。

### 5.5 HearingSheet（`src/lib/hearing.ts`）

`data/hearings/<slug>.json` にファイル保存されます。

| フィールド | 内容 |
|---|---|
| `slug` | ASCII のみ。日本語医院名は `clinic-<base36>` にフォールバック |
| `ownerEmail` | 申請者。旧 `/create` 経由では未設定 |
| `clinicName` `directorName` `address` `phone` `line` | 基本情報 |
| `department` `serviceNames[]` `hours` `features` `featureNames[]` `targetNames[]` `request` | 診療内容・特徴・要望 |
| `staffMembers[]` | `{name, comment, role?, photoUrl?}`。件数がカード数になる |
| `faqs[]` | 実データがあれば AI 創作より優先 |
| `news[]` | 空なら AI が一般的な内容を生成 |
| `priceItems[]` | **AI 創作しない**。空ならセクションごと非表示 |
| `uploadedImages` | カテゴリ → Supabase Storage 公開 URL の配列 |
| `templateId` `templateLabel` | **AI が選んだ結果の記録**（ユーザーの選択ではない） |
| `templateReason` | AI が選んだ理由（1 文） |
| `previewUrl` `generationError` `cloudflareUrl` `cloudflareError` | 生成・公開の結果 |

画像カテゴリは 3 種：`exterior`（外部写真）／`interior`（内部写真）／`atmosphere`（治療雰囲気写真）。

### 5.6 申請ステータス（`hearingStatus()`）

`/admin/requests` と `/mypage/requests` で共有されます。

| 状態 | 判定 | 意味 |
|---|---|---|
| **承認待ち** | `templateId` なし | 申請は届いたが未承認 |
| 処理中 | `templateId` あり・`previewUrl` なし・エラーなし | 生成結果が未記録（通常は一瞬） |
| 生成済み | `previewUrl` あり | 生成成功 |
| 生成失敗 | `generationError` あり | 管理者が再実行できる |

---

## 6. 機能仕様

### 6.1 全体フロー

```
【管理者】テンプレートを作る
  (A) 作成済みサイトから作る … デザイン値を「読み取る」（推測なし）
  (B) 外部サイトのURLから作る … HTML/CSS を解析して AI が数値化
    → D1 に isTemplate=true / canSell=false で保存
    → 編集画面で微調整 → 「販売可」に切替

【ユーザー】サイトを作る
  ヒアリングシート入力（テンプレートは選ばない）
    → AI が canSell=true のテンプレから最適な1つを自動選択
    → デザインと構成を複製
    → AI が文章を執筆・画像を生成して差し替え
    → D1 に保存 ＋ public/generated/<slug>/ へ書き出し

【両方】編集する
  同じデータ構造 → 編集画面は1つを共用
```

### 6.2 クリニックオーナーの申請（`/mypage/apply`）

ウィザード形式。各ステップを自由に前後移動し、確認画面から送信します。

| Step | 内容 | 必須 |
|---|---|---|
| 1 | 基本情報（クリニック名・住所・電話・LINE） | クリニック名のみ |
| 2 | 写真（外部・内部・治療雰囲気）。ファイル or URL | 任意 |
| 3 | 診療科・サービス選択 | 任意 |
| 4 | 医院の特徴選択 | 任意 |
| 5 | ターゲット選択 | 任意 |
| 6 | 確認・申請 | — |

**デザインテンプレートの選択項目も、サイトカラーの選択項目も存在しません。** 送信すると `/mypage/requests` へ遷移し「承認待ち」になります。この時点ではまだサイトは生成されません。

### 6.3 管理者の承認・生成（`approveRequestAction`）

`/admin/requests` に全クリニック横断で申請が並び、「承認待ち」の行にのみ**「承認して生成」の 1 ボタン**が出ます。テンプレートは AI が選ぶため、管理者が選ぶセレクトボックスはありません。

生成は**インラインで同期実行**されます（キューイングしない）。管理者がその場で結果を見られるようにするためです。選ばれた理由（`templateReason`）はサイト詳細画面に表示され、**テンプレートの `mood` 文を直せば選定精度が上がる**という運用ができます。

### 6.4 テンプレート作成 (A) — 作成済みサイトから（`importFromGeneratedSite.ts`）

**推測がゼロ**の経路です。生成済みページは自分のデザインを `<html style>` にインラインで持っています（`--primary` `--radius` `--font` `--space-scale`）。加えて `hero-split` `cards-list` といったクラス名があるため、**トークンは「推論」ではなく「読み取り」**になります。

写真もそのまま引き継ぎます。自社が自社サイトのために生成した画像なので、第三者サイトと違い再利用に問題がありません。テンプレートが実写真でプレビューされるため、良し悪しの判断もしやすくなります。

**AI に任せるのは名前・雰囲気説明（`mood`）・タグのみ**です。判断が本当に必要なのはそこだけで、`mood` は自動選択が読む唯一の材料だからです。

### 6.5 テンプレート作成 (B) — 外部サイトの URL から（`importFromUrl.ts`）

```
1. extractDesignSignals(url) … HTML/CSS を機械的に計測
2. 参考画像の URL を検証（到達確認）
3. 計測結果（散文化）＋画像を gpt-5.6-terra に渡す
4. AI が DesignTokens 候補 ＋ mood ＋ tags を構造化出力で返す
5. normalizeDesignTokens() で全値をクランプ・フィールド単位でフォールバック
6. defaultTemplateBlocks() にサンプル文章を載せてブロック配列を構成
7. D1 に isTemplate=true / canSell=false で保存
8. renderSiteFiles() でプレビューを書き出し
```

**取り込むのはデザインの「方向性」（配色・書体・角丸・影の深さ・動き）だけ**であり、参考サイトの内容や画像ファイルは取りません。画像は解析のためにモデルへ URL として見せるだけで、**ダウンロードも保存もしません**。

#### AI の数値は「真実」ではなく「提案」として扱う

OpenAI の構造化出力は**数値の上下限や文字列パターンを強制できません**。そのため AI に渡すスキーマは意図的に緩く（min/max なし・色の正規表現なし）、検証は `normalizeDesignTokens()` が行います。全値をレンダラーが表現できる範囲にクランプし、駄目ならフィールド単位で `DEFAULT_DESIGN_TOKENS` に落とします。フォントスタックに総称ファミリが無ければ補います（無いと、先頭のファミリを持たない環境で Times になるため）。

#### WordPress 対策（実務上の要）

日本のクリニックサイトは WordPress が大多数です。素朴に「最初の数枚のスタイルシート」を読むと、WordPress の既定エディタパレットと Font Awesome のアイコンアニメーションを説明するだけで、そのクリニックについては何も分かりません。

| 除外・優先の仕組み | 内容 |
|---|---|
| `BOILERPLATE_STYLESHEET` | フレームワーク由来の CSS を除外 |
| `THEME_STYLESHEET` | `/wp-content/themes/`・`style.css`・`main.css`・`common.css` 等を優先取得 |
| `FRAMEWORK_PROPERTY` | `--wp-` `--fa-` `--bs-` `--tw-` `--swiper-` `--slick-` を除外 |
| `ICON_FONT` | Font Awesome・dashicons 等を font-family 集計から除外（アイコン規則が繰り返されるため、本文フォントより多く出現してしまう） |

**取得上限**：HTML 1MB、CSS 5 ファイル・合計 700KB。

#### 画像の堅牢化

- **形式フィルタ**：OpenAI の画像入力は jpeg/png/gif/webp のみ。SVG ロゴや .ico ファビコンが混ざると**リクエスト全体が失敗**するため、収集時点で除外します（拡張子なしの URL は CDN で多いので残します）
- **到達確認**：`HEAD` ではなく **1 バイトのレンジ GET**（HEAD に 405 を返すサーバーが多いため）。1 つのリンク切れが「Error while downloading file」という、どの画像が原因か分からないエラーで全体を失敗させるのを防ぎます
- **画像なし再試行**：それでも失敗したら画像を外して 1 回だけ再試行し、警告を返します

#### 警告の返却

SPA（React 製など）は HTML に中身が無く CSS もほとんど読めません。`looksClientRendered` を検出して**管理者に警告を返します**（「参考画像を追加するか、作成後に編集画面で調整してください」）。結果を黙って defaults で埋めるのではなく、何に依拠した結果かを伝える設計です。

#### 保存失敗時のロールバック

D1 への保存は「サイト行」「ブロック行」の 2 系統に分かれ、**両者をまたぐトランザクションがありません**。途中で失敗するとブロックのないテンプレートが残り、管理画面には実在する壊れたテンプレートとして並びます。そのため失敗時は `deleteDocument()` で行を巻き戻します。

### 6.6 テンプレート自動選択（`selectTemplate.ts`）

クリニックは選びません。それがこのフローの主眼であるため、**十分な精度が必要である一方、生成失敗の原因になっては絶対にいけません**。全失敗経路がフォールバックします。

| 状況 | 動作 |
|---|---|
| `canSell=true` のテンプレートが 0 件 | 組み込みの標準テンプレート（`buildDefaultTemplate()`） |
| 1 件 | **AI を呼ばずに**そのテンプレートを使用 |
| 2 件以上 | AI が選択 |
| AI が候補外の id を返した | 最新のテンプレートにフォールバック（警告ログ） |
| AI 呼び出しが例外 | 同上。**例外を投げない** |

モデルに見せるのは**各テンプレートの名前・`mood`・タグだけ**です。これは意図的で、`mood` は管理者が書く文章なので、**選定精度の改善はプロンプト調整ではなく編集作業になります**。

システムプロンプトは診療科の対象年齢層（小児科なら明るく親しみやすい、審美・自由診療なら落ち着いた高級感）、患者層、要望との相性を重視するよう指示しています。

### 6.7 サイト生成パイプライン（`siteGenerator.ts`）

```
generateSite(hearing)
 1. selectTemplate(hearing)              テンプレート決定
 2. instantiateTemplate()                深いコピー。新ID・templateId記録・テンプレ専用項目を落とす
 3. meta にクリニック名・電話・LINE・住所を反映
 4. applyFactualVisibility()             材料が無いブロックを非表示に
 5. generateContentPlan()                文章をAIが執筆
 6. applyContentPlan()                   文章をブロックへ
 7. applyFactualContent()                ヒアリングの事実をブロックへコピー
 8. rm -rf outDir → mkdir                ★全再生成なのでここだけ削除が正しい
 9. produceImages()                      アップロード写真の割当 + AI生成（並列度3）
10. applyImagePaths()
11. saveDocument(doc)                    D1へ
12. renderSiteFiles(doc)                 静的ファイル書き出し
```

#### 事実に基づく非表示（Step 4）

材料が無いブロックを**文章生成の前に**隠します。空の料金表は「料金表が無い」より悪く、見出しの下に空の表が出て**壊れたページに見える**ためです。生成前に隠すことで、出荷されないセクションの文章をモデルが書くことも防げます。

対象：`hours`（診療時間の記載）／`access`（住所）／`staff`（スタッフ）／`pricing`（料金）。

#### 事実のコピー（Step 7）

**この複製こそが後の編集を可能にします。** ここから先はドキュメントが正であり、レンダリング時にヒアリングシートを読み直すと（旧実装がそうしていた）**ユーザーの編集を黙って取り消してしまいます**。

- `hours.rows` … `hearing.hours` を改行分割し `ラベル：値` を分解。**決定論的で AI を通しません**。クリニックが実際に入力した内容から乖離しないため
- `access` … 住所と、そこから導出した `mapQuery`（別々に編集可能。郵便住所と地図のピンは必ずしも一致しないため）
- `pricing` `staff` … そのまま複製
- `news` `faq` … **実データが常に勝ち**、AI の一般的な内容は空のときだけ埋める

#### 文章生成（`generateContentPlan.ts`）

モデルに見せるのは**テンプレートそのもの**です。各「執筆対象」ブロックの type・navLabel・サンプル見出しがブリーフになります。旧 SITE_SPEC 版のように `department / greeting / features / facility` を列挙しないため、**テンプレートに 5 つ目のセクションを足しても、並べ替えてもコード変更なしに機能します**。

**執筆対象**：`hero` `rich` `freeText` `contact` `gallery` `imageBanner`  
**モデルに渡さない**：`hours` `access` `pricing` `staff`（事実の報告であって執筆ではない）。`news` `faq` はクリニックが未提供のときだけ例外的に依頼。

繰り返し項目の件数は、テンプレートのサンプルが示す件数を目標値として渡します（3 カラム前提のテンプレートに 7 枚返らないように）。

出力の全文字列から **HTML タグらしきものを除去**します。React が自動エスケープするため XSS ではありませんが、モデルがヒーロー見出しに改行のつもりで `<br>` を混ぜることが実際にあり、そのままだと醜い literal として表示されるためです。

#### 執筆ルール（`authoringRules.ts`）

テンプレートの行ではなくコードに置かれています。**デザインの選択ではないため、管理者が「AI は電話番号を創作してはならない」というルールを無効化できてはいけない**からです。

```
HONESTY_RULES（最重要）
  1. 電話番号・住所・LINE・診療時間・料金は hearing の実データのみ。AIは絶対に創作しない。
     記載が無ければ該当箇所を非表示にする
  2. お知らせ・よくある質問のみ、実データが無い場合にAIが一般的な内容を生成してよい
  3. 資格・実績年数・症例数など、hearingに記載の無い具体的事実を創作しない

IMAGE_STYLE_RULES
  ・被写体をキャンバス端まで届かせる（白フチ・レターボックスを作らない）
  ・明るく清潔感のある医療機関らしい構図。顔のクローズアップは避ける
  ・画像内に文字・ウォーターマークを入れない

LOGO_RULE
  ・医療系モチーフのみ。医院名などの文字は入れない（HTMLテキスト側で表示）。背景は透過
```

#### 画像の解決（`produceImages`）

**クリニックが実際にアップロードした写真が、常に生成画像に優先します。**

```
1. matchImagesToCategories()   AIが「どの配置にどのカテゴリの写真が合うか」を判定
2. スタッフ本人の photoUrl があれば、カテゴリ判定より優先（強制割当）
3. 割り当たらなかった配置だけを AI 生成（並列度 3）
4. 各アップロード写真は最大1回まで使用
```

**構造的な保証**（モデルに任せられない分）として、ロゴとヒーロー画像は計画に無くても必ずジョブに積みます。ロゴが無いと全ページに壊れた `<img>` が残るためです。

`cardLayout === "minimal"` のときは `rich` のカード画像ジョブを積みません。**どの `<img>` も指さないファイルに実際の画像生成 API 料金を払うことになる**ためです。

### 6.8 画像生成（`generateSiteImage.ts`）

| 用途 | モデル | 理由 |
|---|---|---|
| ロゴ・アイコン | `gpt-image-1` | 透過に対応。ただしサイズは 1024x1024 / 1536x1024 / 1024x1536 の 3 固定 |
| それ以外 | `gpt-image-2` | 任意解像度でアスペクト比を合わせられる。**ただし `background:"transparent"` を API が明確に拒否する** |

- **最小ピクセル制約**：`gpt-image-2` には総ピクセル数の下限があり（`400 Invalid size ... below the current minimum pixel budget`）、正確な規則は非公開。1024×1024 ≒ 105 万 px を下限として計算し、それでも 400 なら **1024x1024 で 1 回だけ再試行**します
- **透過の徹底**：`background:"transparent"` パラメータだけではモデルが背景に不透明な図形（円・バッジ・カード・影の板）を描いてしまうため、**プロンプトでも明示的に全面禁止**しています

アスペクト比は `1:1`(1024²) / `4:3`(1200×900) / `16:9`(1200×675) / `2:1`(1200×600)。

### 6.9 画像アップロード（`POST /api/uploads`）

| 項目 | 値 |
|---|---|
| 保存先 | Supabase Storage（`SUPABASE_STORAGE_BUCKET`、既定 `site-images`）、`clinc-hp/<category>/<uuid>.<ext>` |
| 枚数 | 最大 10 枚／回 |
| サイズ | 最大 8MB／ファイル |
| MIME | `image/*` のみ |
| カテゴリ | `^[a-z0-9_-]{1,32}$` |

### 6.10 編集画面

テンプレートとサイトで**同一の `SiteEditor` コンポーネント**を使います。「テンプレート編集画面」という別物が存在しないため、本物との同期ズレが起きません。

| ルート | 対象 | 権限 |
|---|---|---|
| `/admin/templates/[id]` | テンプレート | 管理者のみ（レイアウトでロールをガード） |
| `/sites/[slug]/edit` | サイト | オーナー＋管理者 |

`/sites/[slug]/edit` は**意図的に `/admin/*` にも `/mypage/*` にも属しません**。前者は管理者専用、後者は `clinic_owner` 専用ですが、この 1 画面だけは両方に応える必要があるためです。チェックはページと、より重要な点として**すべての編集 Server Action**にあります。

**画面構成**：左＝ブロック一覧（ドラッグ・↑↓・表示切替・削除）、中＝レジストリから自動生成されるフォーム、＋ブロック追加パレット（単一制約のブロックは使用済みでグレーアウト）、デザインパネル、基本情報パネル、右＝ライブプレビュー iframe、未保存インジケータ。

#### Server Action（`editorActions.ts`）

| アクション | 内容 |
|---|---|
| `saveDocumentAction(id, doc)` | 権限 → 識別子を保存済み行から復元 → zod 検証 → D1 保存 → `renderSiteFiles()` → `revalidatePath` |
| `adoptImageAction(id, sourceUrl)` | Supabase Storage の画像をサイト出力ディレクトリへ複製し、**サイト相対パス**を返す |
| `publishDocumentAction(id)` | 再レンダリング → Cloudflare Pages へ公開。**テンプレートは公開不可** |

`adoptImageAction` の複製は冗長ではありません。生成サイトは自己完結ディレクトリとして Cloudflare Pages に配布されるため、`<img>` が Supabase Storage の URL を指していると、**公開後のすべてのページがそのバケットの到達性とオブジェクトの公開状態に依存し続けます**。

`saveDocumentAction` は `updatedAt` を返します。編集画面が**自分で発明していない値**でプレビュー iframe のキャッシュを破棄できるようにするためです。

### 6.11 レンダリング（`renderSiteFiles.ts`）

`index.html` ＋ `css/site.css` ＋ `js/main.js` ＋ `images/placeholder.svg` を書き出します。

> **AI を一切呼ばず、画像ファイルに一切触れません。** これが編集画面の「保存」のすべてであり、文章編集が数分ではなく一瞬で終わり、料金もかからない理由です。

> **出力ディレクトリを絶対に削除しません。** 画像は `<outDir>/images/` にあり、**ドキュメントからは再現できません**（一度だけ生成またはアップロードされたもの）。旧実装のように毎回削除すると、書いたばかりの HTML の全 `<img>` が存在しないファイルを指すことになります。削除が正しいのは `siteGenerator` の全再生成時だけです。

**出力先**：サイトは `public/generated/<slug>/`、テンプレートは `public/generated/_templates/<id>/`。先頭のアンダースコアで、`[a-z0-9-]` しか取らない生成スラッグとの衝突を防いでいます。

`ensureRenderedSite()` は、D1 にドキュメントがあってもディスクにファイルが無い場合（新規チェックアウト、`public/generated` の掃除、書き込み中の dev サーバー停止）にレンダリングし直します。**空の iframe は「ファイルが無い」ではなく「編集画面が壊れている」ように見える**ためです。

### 6.12 公開（`cloudflareDeploy.ts`）

```
npx wrangler pages deploy public/generated/<slug> \
  --project-name clinc-hp-<slug>  (58文字で切り詰め) --branch preview
```

タイムアウト 5 分。標準出力から `https://*.pages.dev` を正規表現で抽出します。ディレクトリを丸ごと配るため、**編集結果はそのまま反映されます**。

---

## 7. 画面一覧

### 7.1 クリニックオーナー向け

| ルート | 画面 |
|---|---|
| `/` | ログイン |
| `/signup` | アカウント登録（`clinic_owner` 固定） |
| `/home` | ホーム（サイドバー＋トップバー） |
| `/mypage` | マイページ |
| `/mypage/apply` | 新規申請ウィザード（6 ステップ） |
| `/mypage/requests` | 申請一覧（自分の分のみ） |
| `/mypage/sites` | サイト一覧（生成完了分のみ）＋「編集する」 |
| `/sites` | 全サイト一覧 |
| `/sites/[slug]` | サイト詳細・プレビュー |
| `/sites/[slug]/edit` | **サイト編集**（オーナー＋管理者） |
| `/create` | 旧・作成フォーム（2 ステップ） |

### 7.2 管理者向け（`src/app/admin/(dashboard)/`）

| ルート | 画面 |
|---|---|
| `/admin` | 管理者ログイン |
| `/admin/dashboard` | ダッシュボード |
| `/admin/requests` | **リクエスト管理（中心業務）**。「承認して生成」 |
| `/admin/templates` | テンプレート一覧。販売可切替・削除 |
| `/admin/templates/new` | テンプレート新規作成（2 経路） |
| `/admin/templates/[id]` | **テンプレート編集**（`SiteEditor`） |
| `/admin/sections` | セクション種別（固定カタログ） |
| `/admin/departments` `/admin/departments/[id]` | 診療科・サービス管理 |
| `/admin/features` | 特徴タグ管理 |
| `/admin/targets` | ターゲットタグ管理 |
| `/admin/users` | クリニックオーナー管理 |

### 7.3 API

`POST /api/uploads` — 画像アップロード

---

## 8. サーバーアクション一覧

| モジュール | アクション |
|---|---|
| `authActions.ts` | `loginClinicOwnerAction` / `loginAdminAction` / `signupClinicOwnerAction` / `logoutAction` |
| `actions.ts` | `createHearingAction` / `regenerateSiteAction` / `deployToCloudflareAction` |
| `applicationActions.ts` | `createApplicationAction` / `deleteOwnApplicationAction` |
| `contentActions.ts` | `approveRequestAction` / `deleteRequestAction` / ユーザー・サイト・セクション・診療科・サービス・特徴・ターゲットの CRUD |
| `templateActions.ts` | `importTemplateAction` / `importFromGeneratedSiteAction` / `setTemplateCanSellAction` / `deleteTemplateAction` |
| `site/editorActions.ts` | `saveDocumentAction` / `adoptImageAction` / `publishDocumentAction` |

### 8.1 ハイドレーション前送信への対応

`templateActions.ts` の `readField()` は `formData.get(name) ?? formData.get("_1_" + name)` を読みます。

**React のハイドレーション前にフォームが送信されると、React は素のブラウザ POST にフォールバックし、引数を位置引数としてエンコードします**（`_1_<name>`。引数 0 は前回の state）。素の名前だけを読むと、**URL が明らかに入っていたフォームが「URLを入力してください」で弾かれます**。実際に報告された不具合であり、両形式を読むことで解消しています。

---

## 9. セキュリティ

### 9.1 SSRF 対策（`safeFetch.ts`）

管理者が入力した URL をサーバーが fetch するため、**一般論として攻撃者の影響下にある URL** として扱います（管理者はソーシャルエンジニアリングされうるし、この経路がセルフサービス化されれば即座に穴になる）。素朴な `fetch(userUrl)` は `http://localhost:3000/api/...`、`169.254.169.254` のクラウドメタデータ、ブラウザからは決して届かない社内ネットワークを読めてしまいます。

**ガードの順序**：スキーム → ホスト名／IP レンジ → **リダイレクト各ホップの再検査** → レスポンスサイズ → タイムアウト。

| ガード | 内容 |
|---|---|
| スキーム | `http:` `https:` 以外を拒否 |
| ホスト名 | `localhost` / `*.localhost` / `*.local` / `*.internal` |
| **DNS 解決** | ホスト名を `lookup(all)` し、**解決先が private なら拒否**（ホスト名は IP 直書きと同じくらい簡単に private を指せる） |
| IPv4 | `0.*` `10.*` `127.*` `169.254.*`（メタデータ含む） `172.16-31.*` `192.168.*` `100.64-127.*`（CGNAT） |
| IPv6 | `::1` `::` `fc*`/`fd*`（ULA） `fe80*`（リンクローカル）、**`::ffff:` の IPv4 マップ**（v4 チェックをすり抜けるため） |
| 不明な形式 | **推測せず拒否** |
| リダイレクト | `redirect: "manual"` で手動追跡、最大 3 ホップ、**各ホップで同じホスト検査**（公開 URL が `169.254.169.254` へ 302 する攻撃を防ぐ） |
| サイズ | ストリームを読みながら上限で abort（バッファリングしない） |
| タイムアウト | 10 秒 |

### 9.2 権限

3.1 / 3.2 参照。すべての更新系 Server Action の先頭でチェックし、`saveDocumentAction` は識別子を保存済み行から復元します。

### 9.3 著作権

外部サイトから取り込むのは**デザインの方向性のみ**で、コンテンツの複製ではありません。参考サイトの画像は**モデルに URL として見せるだけで、ダウンロードも保存もしません**。テンプレートのサンプル画像はプレースホルダで、管理者が編集画面で差し替えます。

### 9.4 アクセシビリティ（`color.ts`）

テンプレートの配色は任意の参考サイトから来るため、**読める組み合わせである保証がありません**。ブランドのアクセントはボタンの塗りとしては正しく、白地の本文としては判読不能な明るい黄色やライムであることが多く、取り込み側には参考サイトがどちらの用途で使っていたか知る術がありません。

**モデルに正しく判断させるのではなく、レンダラーが保証付きの派生色を導きます。**

```
readableOn(color, background, fallback, minRatio = 4.5)
  1. すでに WCAG コントラスト比 4.5 以上ならそのまま返す
  2. 背景の相対輝度 > 0.4 なら黒へ、そうでなければ白へ
  3. 10% 刻みで混色し、4.5 を超えた最初の候補を返す
  4. 純黒／純白でも届かない（＝背景が中間グレー）ときだけ fallback
```

**色相は保たれる**ため、結果は依然としてブランドカラーとして読めます。WCAG 相対輝度とコントラスト比は仕様どおりに実装されています。

### 9.5 認証

- パスワード：scrypt（ソルト付き）、定数時間比較
- セッション：32 バイト乱数、TTL 7 日、`httpOnly` + `SameSite=Lax`

---

## 10. レスポンシブ対応の既知修正

| 問題 | 原因 | 対策 |
|---|---|---|
| LINE / 電話ボタンの幅が不一致（210px vs 218px） | 幅が文字数依存（「LINEで相談・予約する」と「お電話で相談・予約する」の 1 文字差） | SP 幅（560px 以下）で縦積み・幅 100%（→ 両方 338px） |
| ヒーロー文字がヘッダーに重なり次セクションへはみ出す | `hero-full-bleed` で文字側が絶対配置のため親の高さを押し広げられない（上 77px・下 78px 溢れ） | 画像と文字を **CSS Grid の同じマスに重ねる**。行の高さが両者の大きい方になり原理的に溢れない |

修正は大元の `src/lib/render/site.css` に入っています。

---

## 11. 運用手順

### 11.1 コマンド

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run lint         # ESLint
npm run clean        # rm -rf .next tsconfig.tsbuildinfo
npx tsc --noEmit     # 型チェック
```

### 11.2 マイグレーション

```bash
node scripts/migrate.mjs                              # 全件
node scripts/migrate.mjs --file 0003_site_documents.sql  # 個別
```

`.env.local` を自前でパースし、アプリと同じ D1 HTTP API を叩くため **`wrangler login` 不要**です。**再実行安全**：文は構造上冪等（`IF NOT EXISTS` / `INSERT OR IGNORE`）で、冪等にできない `ALTER TABLE ADD COLUMN` だけは `duplicate column` / `already exists` での失敗を許容します。

行コメントを先に除去してから `;` で分割するため、`--` 行に含まれるセミコロンが文を分断しません。

### 11.3 初期管理者

```bash
node scripts/seed-admin.mjs
```

### 11.4 導入順序

1. `.env.local` を用意
2. `node scripts/migrate.mjs`
3. `node scripts/seed-admin.mjs`
4. マスタデータ（診療科・サービス・特徴・ターゲット）を登録
5. **テンプレートを 3〜5 個作る**
6. プレビュー確認のうえ「販売可」に切替

> テンプレートが 0 件でも生成は動きます（`buildDefaultTemplate()` が標準レイアウトを返す）。1 件だけの場合は AI を呼ばずそれを使います。**自動選択が意味を持つのは 2 件以上から**です。

---

## 12. 既知の制約

| # | 制約 | 詳細 |
|---|---|---|
| 1 | 2026-08-19 以前のサイトは SiteDocument を持たない | 編集不可。「AI で再生成する」で作り直す。`store.ts` は `design`/`meta` 欠落行にフォールバックを当てて**編集画面で開けるようにする**（唯一直せる場所であるため） |
| 2 | **同時編集の制御なし** | 後勝ち。`updated_at` による衝突検出は未実装 |
| 3 | SPA は URL 取り込みが効きにくい | `looksClientRendered` を検出して警告を返す |
| 4 | ローカルサイトは URL 取り込み不可 | SSRF 防御が `localhost` を拒否するため。代わりに「作成済みサイトから作る」経路がファイルを直接読む |
| 5 | ヒアリングシート・生成サイトがローカルファイル | 13.2 参照 |
| 6 | 旧フロー `/create` が並存 | 13.3 参照 |
| 7 | **自動テストが 1 件も存在しない** | テストフレームワーク自体が未導入 |
| 8 | `hp-templates/` が残存 | `AI_GUIDE.md` `NEXTJS_TAILWIND_GSAP_GUIDE.md` `SITE_SPEC.json` `TEMPLATE_VARIABLES.md` `colors.json` `presets/`。**コードからの参照はゼロ** |
| 9 | `docs/` が空 | 旧 `USER_ADMIN_GUIDE.md` は削除済み。本書が唯一のドキュメント |
| 10 | 変更が未コミット | 7 ファイル変更＋2 ファイル未追跡 |

---

## 13. 分析所見と改善提言

### 13.1 v1.0 からの訂正

実ソース照合で判明した、v1.0（推定版）の誤りです。

| v1.0 の記述 | 実際 |
|---|---|
| 「SiteDocument 保存は 12〜13 往復」 | **3〜4 往復**。`store.ts` は upsert + delete + **100 件チャンクの複数行 INSERT** で「1 ブロック 1 文」を避けている（コメントに「~20 ではなく ~4 往復」と明記） |
| 「編集フォームのフィールド種別は 4 つ」 | **6 つ**（`text` `textarea` `image` `url` `select` `list`） |
| 「テンプレート編集は `/admin/templates/[id]/edit`」 | **`/admin/templates/[id]`**（`/edit` は無い） |
| 「`assignTemplateAction`」 | **`approveRequestAction`** |
| 「ステータスは『審査待ち』」 | **「承認待ち」** |
| 「`verify_*.mts` が 10 本残っている」 | **削除済み**。ただしテストは 1 件も無い |
| 「`docs/USER_ADMIN_GUIDE.md` が陳腐化」 | **ファイルごと削除済み**。`docs/` は空 |
| 「`hp-templates/template0001〜0006/` が残存」 | 個別テンプレートディレクトリは削除済み。ルートの MD/JSON と `presets/` のみ残存 |
| SSRF 防御の記述が「ブロックリスト」 | 実際は **DNS 解決チェック＋リダイレクト各ホップ再検査＋IPv4 マップ IPv6＋CGNAT** まで含む、想定よりかなり厳格な実装 |
| `SiteMeta` の内容が不明 | `logoImage` `snsLinks[]` と 5 項目の SEO を含む |
| 「著作権上、参考画像は保存しない」 | 正しい。加えて**フォーマット制限と到達確認**まで実装されていた |

### 13.2 【最優先】永続化がローカルファイルシステムに依存している

**事実**：ヒアリングシート＝`data/hearings/*.json`、生成サイト＝`public/generated/<slug>/`、公開＝そのディレクトリを `wrangler` の子プロセスに渡す。

**問題**：**単一マシンでの運用が暗黙の前提**になっています。Vercel / Workers / コンテナ等に載せると、

1. `public/` はビルド成果物であり、実行時に書いても次のデプロイで消える
2. 複数インスタンスだと、生成したインスタンスと閲覧要求を受けたインスタンスが一致しない
3. `execFile("npx", ["wrangler", ...])` という前提が本番ホスティングで成立しにくい

ユーザー・マスタデータ・SiteDocument はすでに D1 にあるため、残るのはこの 2 つだけです。

**提言**：生成物とヒアリングシートを Supabase Storage / D1 へ移し、公開は Pages **Direct Upload API** に置き換える。これで実行環境の制約から解放されます。

### 13.3 【高】生成フローが 2 系統並存している

`/create`（承認なし・その場で生成）と `/mypage/apply` → `/admin/requests`（申請・承認型）が同じ `data/hearings/*.json` を共有しています。**申請・承認型で守っているはずの統制を旧フローから迂回できます。**

**提言**：`/create` を廃止するか、管理者専用として認証で塞ぐ。

### 13.4 【高】保存のアトミック性が経路によって不揃い

`d1Query()` は 1 文しか送れず、SiteDocument の保存は「sites の upsert」「site_sections の delete」「チャンク insert」に分かれ、**それらをまたぐトランザクションがありません**。

現状の対応状況は経路ごとに異なります。

| 経路 | 補償処理 |
|---|---|
| `importFromUrl`（334行目付近） | **あり** — 失敗時に `deleteDocument` でロールバック |
| `importFromGeneratedSite`（272行目） | **あり** — 同上 |
| **`saveDocumentAction`（編集の保存）** | **なし** |

編集保存は `DELETE FROM site_sections` の後に `INSERT` が失敗すると、**ブロックが消えたドキュメントが残ります**。ユーザーの編集内容がまるごと失われる、最も実害の大きい失敗です。

なお、取り込み経路の対策をそのまま持ってくることはできません。あちらは**新規ドキュメント**なので `deleteDocument` が正しい巻き戻しになりますが、編集は既存ドキュメントが相手なので、同じことをすればサイトごと消えます。**別の補償が必要**です。

**提言**：(1) D1 のバッチ実行エンドポイントを使う、または `d1Query` に複数文・トランザクション対応を足す（本筋）。(2) 当座の措置として、`saveDocument` の中で削除前に既存ブロック行を読み出しておき、insert 失敗時に書き戻す。

### 13.5 【中】生成処理が同期的で長時間

`approveRequestAction` は `generateSite` を**インラインで実行**します（コメントに「管理者がその場で結果を見られるように」と意図が明記）。中身は AI 呼び出し（テンプレ選択・文章・画像 8 枚前後、並列度 3）で、数十秒〜数分かかります。

**問題**：ホスティングの実行時間上限に当たりやすく、リトライ単位が粗く（全部やり直し）、進捗が見えません。

**提言**：ジョブ化する。意図（即座のフィードバック）は、ステータス列＋ポーリングでも満たせます。

### 13.6 【中】`site_sections.id` が主キーとブロック ID を兼ねている

`"<siteId>:<blockId>"` という名前空間化で衝突は解決済みですが、**アプリケーション上の識別子と DB 主キーの兼用**という歪みは残ります。`(site_id, block_id)` の複合ユニーク制約＋独立サロゲートキーが素直です。移行が必要なので急ぎではありません。

### 13.7 【中】セッションの後始末がない

- `login()` が既存セッションを消さないため、ログインのたびに行が増える
- 期限切れ行を消すのは、**そのトークンでアクセスがあったとき**だけ（`getSession()` 内）
- 誰もアクセスしない期限切れ行は永久に残る

**提言**：ログイン時に同一ユーザーの期限切れセッションを削除する 1 文でほぼ解決します。

### 13.8 【中】自動テストが 1 件も無い

`verify_*.mts` は掃除されましたが、**テストフレームワーク自体が未導入**です。以下は自動テストの価値が特に高い箇所です。

1. **`safeFetch.assertPublicUrl`** — セキュリティの要。IPv4 マップ IPv6、CGNAT、リダイレクトホップは**表駆動テストが極めて書きやすく**、リグレッションは致命的
2. **`color.readableOn`** — 入力色→出力色の期待値表にできる
3. **`normalizeDesignTokens`** — 全フィールドのクランプとフォールバック
4. **`hoursRowsFromHearing`** — `ラベル：値` の分解（全角・半角コロン、コロンなし）
5. **`hearingStatus`** — 2 画面で共有される状態遷移
6. **`store.blockIdFromRow`** — 接頭辞ありと無しの後方互換

### 13.9 【中】認証情報のローテーションを推奨

開発セッション記録（`~/.claude/projects/` に平文保存）を確認したところ、2026-08-09 のセッションで **OpenAI API キー、Cloudflare API トークン、R2 のアクセスキー／シークレットが平文でチャットに貼り付けられています**。

**提言**：該当する鍵をすべてローテーションする。

画像ストレージは Cloudflare R2 を経て、現在は Supabase Storage（`SUPABASE_URL` / `SUPABASE_ANON_KEY`）に戻っています。鍵はサーバー側の `POST /api/uploads` でのみ読まれ、ブラウザに渡る経路はありません。ただし `site-images` バケットは anon ロールに INSERT を許可するポリシーが入っているため、**匿名キーを知る第三者が直接 Supabase へ書き込めます**。書き込みをサーバー経由だけに絞るなら、そのポリシーを外して `SUPABASE_SERVICE_ROLE_KEY` に切り替えること。

### 13.10 【低】Cloudflare Pages のプロジェクト名が衝突しうる

`clinc-hp-<slug>` を 58 文字で単純に切り詰めており、医院名部分が長いと**末尾のユニーク部分が落ちます**。日本語名は `clinic-<suffix>` になるため実害は出にくいものの、英字名の長いクリニックでは衝突の可能性があります。

**提言**：切り詰めるなら末尾のユニーク部分を残す（またはハッシュ付与）。

### 13.11 【低】不要資産の整理

`hp-templates/`（`SITE_SPEC.json` `colors.json` `presets/` 等）はコードから一切参照されていません。`authoringRules.ts` のコメントが示すとおり、内容は既にコードへ移植済みです。

**提言**：`docs/archive/` へ移すか削除し、「仕様ではない」ことを明示する。

### 13.12 評価できる点

実ソースを読んだ上で、設計上優れている点を記録します。**照合前の想定より、品質はかなり高い**です。

- **テンプレートとサイトの同一化**が、編集画面・レンダラー・プレビューの三重実装を一度に回避している
- **`renderSiteFiles()` からの AI 完全分離**が、編集のたびに課金される設計を構造的に排除している
- **ブロックレジストリ 1 枚**がレンダラーと編集フォームを駆動し、レジストリを React フリーに保ってバンドル汚染を避けている
- **`selectTemplate` の全経路フォールバック**。「テンプレート選択は嗜好品、生成成功は必須」という優先順位が明文化され、実装が一致している
- **`HONESTY_RULES` をコード側に置いた判断**。管理者が「AI は電話番号を創作しない」を無効化できない構造は、医療系サービスとして正しい
- **`readableOn()`**。AI に正しく判断させるのではなくアルゴリズムで保証する、という正しいアプローチ
- **SSRF 防御**が DNS 解決とリダイレクト各ホップまでカバーしており、この規模の社内ツールとしては明らかに水準以上
- **`saveDocumentAction` の識別子復元**。改竄ペイロードで所有者移転・テンプレート昇格ができない
- **WordPress ボイラープレート除外**。「日本のクリニックサイトは WordPress が大多数」という現実に実装が向き合っている
- **ハイドレーション前送信への対応**。原因を突き止めた上で両形式を読む対処になっている
- **コメントの質**。ほぼすべての非自明な判断に「なぜそうしたか」が書かれており、本書の大半はコードのコメントから直接構成できた
