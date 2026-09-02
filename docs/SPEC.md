# Clinc-HP 仕様書

個人クリニック（個人／私設クリニック、個人クリニック）向け **ホームページ作成申請アプリ** の
実装仕様。ソースコードから起こした現状仕様であり、`CLAUDE.md` / `AGENTS.md` を補完する。
用語・仕様に齟齬がある場合はコードが正。

- 最終更新: 2026-09-02
- 対象リビジョン: `develop` ブランチ（`1ccc4a5` 時点）
- 関連ドキュメント: [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md),
  [`docs/Clinc-HP_事業説明資料.docx`](Clinc-HP_事業説明資料.docx)

---

## 1. 概要

### 1.1 プロダクトの目的

クリニックのオーナーがヒアリングシート（申請フォーム）を送信すると、管理者がワンクリックで
その内容から **1ページの静的なクリニックサイト** を生成できる、申請受付＋サイト生成アプリ。

### 1.2 登場人物（ロール）

| ロール | 説明 | 主な画面 |
|---|---|---|
| 未ログイン訪問者 | マーケティング用ランディングページの閲覧・新規登録 | `/`, `/login`, `/signup`, `/admin` |
| クリニックオーナー (`clinic_owner`) | サインアップし、ヒアリングシートを申請。自分の申請の閲覧・削除・生成サイトの編集 | `/home`, `/mypage/*` |
| 管理者 (`admin`) | ユーザー管理、申請の閲覧／削除／サイト生成、申請フォームのマスタデータ管理 | `/admin/*` |

### 1.3 スコープ外

サイト生成は「ヒアリングシート → 正規化された `SiteTemplate` → 静的バンドル（その場で編集）」の
1 パスのみ（§8.6〜8.9）。公開ステップ・ブロック単位のドキュメントモデルはない。
`SiteDocument` / `src/lib/site` / `src/lib/render` / `/sites/*` は存在しないので再導入しないこと。

### 1.4 言語方針

- UI ラベル・バリデーションメッセージ・`throw new Error()` のメッセージはすべて **日本語**
  （エラーはそのまま UI に表示される）。
- コードコメントは英語。

---

## 2. 用語

| 用語 | 意味 |
|---|---|
| ヒアリングシート / 申請 / リクエスト | `/mypage/apply` から送信された 1 件の申請。D1 `hearings` テーブルの 1 行（`src/lib/hearing.ts` の `HearingSheet`） |
| slug | 1 件の申請を識別する ASCII 文字列。`generateSlug()` が `<clinic>-<base36 時刻+乱数>` 形式で生成。日本語名は `clinic-<suffix>` にフォールバック |
| 生成サイト / バンドル | ヒアリングシートから生成した静的ファイル一式。`public/_generated/<slug>/` に書き出し、`/api/generated/<slug>/` で配信 |
| `SiteTemplate` | 生成サイトの構造化コンテンツ（`src/lib/generatedSite/types.ts`）。OpenAI が出力し、`normalize.ts` で完全な形に整形され、`render.ts` が消費 |
| nj-site | 生成サイト／プレビューの CSS スコープ（`<div class="nj-site">`）。トークンは `--nj-*` カスタムプロパティ |
| プレビュー | `/preview/<slug>`（React コンポーネントで描画する手組みテンプレート。`/template-create` の成果物） |
| マスタデータ | 申請フォームの選択肢（診療科・サービス・特徴・ターゲット・セクション）。管理者が編集 |

---

## 3. システム構成

### 3.1 ランタイム

- **Next.js 16.3**（App Router、React 19.2、Turbopack）。`next.config.ts` は `output: "standalone"`。
- **通常の Node サーバとして動作**（Workers ランタイムではない）。すべての外部バックエンドは
  SDK を使わず素の `fetch` で HTTP アクセスする（D1・Supabase Storage・OpenAI）。
- Next.js 16 では `middleware.ts` が `proxy.ts` にリネームされている（`src/proxy.ts`）。

> ⚠️ Next.js 16 は破壊的変更を多く含む。Next.js のコードを書く前に
> `node_modules/next/dist/docs/` 内の該当ガイドを読むこと（`AGENTS.md` / `nextjs` スキル）。

### 3.2 ホスティング（Cloudflare Containers）

`wrangler deploy` で以下をデプロイする:

| 要素 | ファイル | 役割 |
|---|---|---|
| Worker（フロントドア） | `worker/index.ts` | 何もせず、1 つの常駐コンテナインスタンスに全リクエストを転送 |
| Container クラス | `ClincHpContainer`（`worker/index.ts`） | `Dockerfile` をビルドしたイメージで Next.js サーバを起動（`defaultPort = 8080`, `sleepAfter = "24h"`） |
| Durable Object | `CLINC_HP_CONTAINER` バインディング | `max_instances: 1` のインスタンスを名前で addressable に保つ |

- コンテナのランタイム秘密は `wrangler secret put <NAME>` で設定し、`worker/index.ts` の
  コンストラクタで `this.envVars` に載せ替える。アプリからは `process.env.*` でローカル開発と
  同じように読む。
- `instance_type: "basic"`（1/4 vCPU / 1 GiB / 4 GB ディスク）。OOM が出たら `standard-*` に上げる。

### 3.3 Dockerfile

`node:22-slim` の 3 ステージ（deps → builder → runner）。`npm run build`（standalone 出力）を
コピーし、`wrangler@4` をグローバルインストール、非 root ユーザ `nextjs` で `node server.js`。

> ⚠️ `Dockerfile` / `worker/index.ts` のコメントに実在しないモジュール名や誤ったパス
> （`/app/public/generated`。実体は `public/_generated/`）が残っている。コメントの負債（§13）。

### 3.4 コンテナディスクは非永続

`public/_generated/*`（生成サイト）はコンテナ自身のディスクに書かれ、再デプロイ／再起動で消える。
ただし生成元の `SiteTemplate` は D1 の `hearings.data.generatedSite.template` に保存されるので、
エディタの「保存」で OpenAI を呼ばずに再レンダリングして復旧できる（§8.7）。

---

## 4. 外部サービス・環境変数

ローカルは `.env.local`、本番は `wrangler secret put`。

| 変数 | 用途 | 未設定時の挙動 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_D1_DATABASE_ID` | D1 HTTP API（`src/lib/d1.ts`） | すべての D1 アクセスが日本語エラーで失敗 |
| `SUPABASE_URL` | Supabase Storage（写真アップロード・生成画像の保存先） | アップロード不可。サイト生成は継続するが画像はプレースホルダ SVG のまま |
| `SUPABASE_SERVICE_ROLE_KEY`（推奨）または `SUPABASE_ANON_KEY` | 同上の認証。service role は RLS をバイパス。anon は bucket に INSERT ポリシーが必要 | 上と同じ |
| `SUPABASE_STORAGE_BUCKET` | バケット名（省略時 `site-images`）。**Public 指定必須** | `site-images` を使用 |
| `OPENAI_API_KEY` | サイト生成（コピー＋写真、`src/lib/openai.ts`） | `/admin/requests` の「サイト生成」ボタンが日本語エラーを返す。他機能は無影響 |
| `OPENAI_TEXT_MODEL` / `OPENAI_IMAGE_MODEL` / `OPENAI_BASE_URL` | モデル上書き | 既定 `gpt-4o` / `gpt-image-1` / `https://api.openai.com/v1` |
| `PREVIEW_BASIC_AUTH` | トンネルデモ用の全体 Basic 認証（`src/proxy.ts`）。形式 `user:password` | 認証なしで素通し（通常のローカル開発） |

> ⚠️ トンネル URL に認証情報を入れない（`https://user:pass@host`）。Chrome がその URL からの
> `fetch` 構築を拒否し、全 Server Action が壊れる。

---

## 5. データモデル

### 5.1 永続化: Cloudflare D1（HTTP 経由）

`src/lib/d1.ts` は D1 REST API に **1 リクエスト 1 ステートメント** で話す。
スキーマは `migrations/*.sql`、`node scripts/migrate.mjs` で適用（`IF NOT EXISTS` /
`INSERT OR IGNORE` / `ALTER TABLE ADD COLUMN` の失敗許容で冪等）。

### 5.2 テーブル

| テーブル | マイグレーション | モジュール | 内容 |
|---|---|---|---|
| `users` | `0001` | `src/lib/auth.ts` | `id`, `email`(UNIQUE), `password_hash`, `password_salt`, `role`(`admin`/`clinic_owner`), `created_at` |
| `sessions` | `0001` | `src/lib/auth.ts` | `token`(PK), `user_id`→`users.id` ON DELETE CASCADE, `role`, `expires_at`, `created_at` |
| `departments` | `0002` | `src/lib/content.ts` | `id`, `name`（診療科） |
| `services` | `0002` | `src/lib/content.ts` | `id`, `department_id`→`departments.id` CASCADE, `name` |
| `features` | `0002` | `src/lib/content.ts` | `id`, `name`（特徴。フラットなタグ） |
| `targets` | `0002` | `src/lib/content.ts` | `id`, `name`（ターゲット患者層。フラットなタグ） |
| `hearings` | `0003` | `src/lib/hearing.ts` | `slug`(PK), `owner_email`, `clinic_name`, `created_at`, `data`(JSON) |
| `sections` | `0004` | `src/lib/content.ts` | `id`, `name`（セクションのマスタ。名前のみ） |

インデックス: `idx_users_email`, `idx_sessions_user_id`, `idx_services_department_id`,
`idx_hearings_owner_email`, `idx_hearings_created_at`。

### 5.3 `hearings.data`（JSON ブロブ）

`slug` / `owner_email` / `clinic_name` / `created_at` のみ独立カラム。申請者が入力した残り全部が
`data` の 1 つの JSON。**送信時に確定し、更新パスはない**（管理者は閲覧と削除のみ。オーナーは
自分の申請の削除と生成サイトの編集のみ）。`saveHearing()` は `slug` で UPSERT。

`HearingSheet`（主なフィールド、`src/lib/hearing.ts`）:

| フィールド | 型 | 由来（申請フォームのステップ） |
|---|---|---|
| `clinicName`, `address`, `phone`, `line` | string | 基本情報 |
| `department` | string | 選択サービスの診療科名を `・` 連結（送信時に導出） |
| `serviceNames`, `featureNames`, `targetNames` | string[] | 診療科／特徴／ターゲットの選択スナップショット |
| `features` | string | `featureNames` を `、` 連結（レガシー自由文。プロンプトが直接読む） |
| `schedule` | `{ days: string[]; rows: {label; marks}[]; notes: string[] }` | 診療時間（構造化。生成サイトにそのまま反映） |
| `hours` | string | レガシー自由文の診療時間（旧レコード用） |
| `director` | `{ name; role; greeting; photoUrl? }` | 院長紹介 |
| `staffMembers` | `{ name; comment; role?; photoUrl? }[]` | レガシー（現フォームは院長のみ） |
| `priceItems` | `{ name; price; note? }[]` | 料金表（金額があるときのみ） |
| `faqs` | `{ question; answer }[]` | よくあるご質問 |
| `news` | `{ date; title }[]` | お知らせ |
| `request` | string | ご要望（自由文） |
| `uploadedImages` | `{ exterior?: string[]; interior?: string[]; atmosphere?: string[] }` | 写真（Supabase の公開 URL） |
| `heroImageUrl` | string | トップ画像 1 枚（ヒーロー背景に使用） |
| `generatedSite` | `{ at; editedAt?; imagesGenerated?; imagesFromUploads?; template? }` | サイト生成後に管理者アクションが付与 |

---

## 6. 認証・認可

### 6.1 パスワード・セッション（`src/lib/auth.ts`）

- パスワードは **scrypt**（64 バイト、16 バイトの hex ソルト）。検証は `timingSafeEqual`。
- セッショントークンは 32 バイト乱数の hex。D1 `sessions` に保存。
- Cookie `session_token`: `httpOnly`, `sameSite=lax`, `path=/`, 本番のみ `secure`, TTL **7 日**。
- `getSession()` は cookie → `sessions JOIN users` を引き、期限切れなら行を削除して `null`。

### 6.2 ロールと画面ガード

- 2 ロール: `admin` / `clinic_owner`。
- ページ側ガード（`layout.tsx` の `redirect()`）だけでは不十分。**Server Action は直接 POST 可能**な
  エンドポイントなので、認可は各アクションの先頭で行う:
  - 管理者アクション（`src/lib/contentActions.ts`）: 各関数の冒頭で `requireAdmin()`。
  - オーナーアクション（`src/lib/applicationActions.ts`）: `getSession()` を再確認し、削除時は
    行の `ownerEmail` とセッションの `email` の一致も確認。
  - 生成サイトのエディタアクション: `requireSiteEditAccess(slug)` が「管理者」または
    「その申請を出した `clinic_owner` 本人」のみ許可。
- `listUsers()` は `role != 'admin'` のみ返す（管理画面に他の管理者を出さない）。
- `listHearingsByOwner()` は SQL の `WHERE owner_email = ?` で自分の申請だけに絞る
  （全件読んで JS で捨てる実装にしない = リーク防止）。

### 6.3 プレビュー用 Basic 認証（`src/proxy.ts`）

- `PREVIEW_BASIC_AUTH` が設定されているときだけ有効。アプリ全体に HTTP Basic をかける
  （トンネルデモ用。アプリ本来のログインの代替ではない）。
- `matcher`: `_next/static` / `_next/image` 以外すべて。`/api/*` と生成サイトはゲートの内側。
- 401 応答に `X-Robots-Tag: noindex, nofollow`。

---

## 7. 画面一覧（ルート）

| パス | ロール | 説明 |
|---|---|---|
| `/` | 公開 | マーケティング用ランディング（`src/app/page.tsx`, `src/components/landing/*`）。`public/landing/templates.json` があればショーケースを表示、なければ非表示。session を読むのは「ログイン済みは自分のページへ」＋「ルートを動的に保つ」ため |
| `/login` | 公開 | クリニックオーナーのログイン |
| `/signup` | 公開 | クリニックオーナーの新規登録（パスワード 8 文字以上、確認一致） |
| `/admin` | 公開 | 管理者ログイン |
| `/home` | clinic_owner | ログイン後の最初の画面。申請件数＋ナビ |
| `/mypage/apply` | clinic_owner | ヒアリングシート申請フォーム（§8.2） |
| `/mypage/requests` | clinic_owner | 自分の申請一覧（閲覧・削除・生成サイトへのリンク） |
| `/mypage/requests/<slug>/edit` | clinic_owner（本人） | 生成サイトのエディタ概要（テーマ・セクション並び） |
| `/mypage/requests/<slug>/edit/<section>` | clinic_owner（本人） | 1 セクションの内容編集 |
| `/admin/dashboard` | admin | ユーザー・リクエスト・部門の件数カード |
| `/admin/users` | admin | `clinic_owner` の一覧・作成・削除 |
| `/admin/requests` | admin | 全申請の一覧。閲覧／削除／「サイト生成」／「編集」 |
| `/admin/requests/<slug>/edit` (+ `/<section>`) | admin | 生成サイトのエディタ（オーナー側と同じコンポーネント） |
| `/admin/departments` (+ `/<id>`) | admin | 診療科とそのサービスの CRUD |
| `/admin/features` | admin | 特徴の CRUD |
| `/admin/targets` | admin | ターゲットの CRUD |
| `/admin/sections` | admin | セクションマスタの CRUD |
| `/preview/<slug>` | 公開（Basic 認証の内側） | 手組みテンプレートの React 描画（`midori`, `nojima`）。生成サイトとは別系統（§9.1） |
| `/api/uploads` | 要ログイン相当 | 写真アップロード（§8.3） |
| `/api/generated/<slug>/[[...path]]` | 要ログイン | 生成サイトバンドルの配信（§8.8） |

アプリシェルの画面は Tailwind v4（`src/app/globals.css`）。

---

## 8. 機能仕様

### 8.1 サインアップ／ログイン（`src/lib/authActions.ts`）

- `signupClinicOwnerAction`: email / password / passwordConfirm。8 文字以上・一致を検証 →
  `createUser(email, pw, "clinic_owner")` → `login()` → `/home` へ redirect。
- `loginClinicOwnerAction`: `login(email, pw, "clinic_owner")` → `/home`。
- `loginAdminAction`: `login(email, pw, "admin")` → `/admin/dashboard`。
- `logoutAction`: セッション削除 → `/`（ログインフォームではなくランディング）へ。
- 管理者アカウントは UI から自己登録できない。`node scripts/seed-admin.mjs <email> <pw> admin` が
  `INSERT` 文を出力（`/admin/users` の作成フォームでも `admin` を選べる）。

### 8.2 ヒアリングシート申請（`src/components/apply/ApplyForm.tsx` → `createApplicationAction`）

- **申請がシステムに入る唯一の経路**。単一のクライアントコンポーネント（約 1,200 行）で
  12 ステップのウィザード。`STEP_TITLES`:
  1. 基本情報（クリニック名〔必須〕・住所・電話・LINE/予約 URL）
  2. 写真（任意。§8.3）
  3. 診療科（`services` をチェック。診療科名は送信時に導出）
  4. 特徴（`features` をチェック）
  5. ターゲット（`targets` をチェック）
  6. 診療時間（構造化グリッド。行 = 時間帯ラベル＋曜日ごとのマーク）
     - マーク: `●` 診療 / `▲` 午前のみ / `／` 休診
  7. 院長紹介（院長名・肩書き〔既定「院長」〕・あいさつ文・写真。すべて任意）
  8. 料金表（任意。金額は創作しないため、実在する場合のみ入力）
  9. よくあるご質問（Q/A のペア）
  10. お知らせ（日付・見出し）
  11. ご要望（自由文）
  12. 申請（入力内容のサマリを確認して送信）
- サーバ側 `createApplicationAction`（`src/lib/applicationActions.ts`）:
  - `getSession()` が `clinic_owner` でなければ拒否。
  - `parseSchedule()` が JSON 文字列の `schedule` フィールドを厳格にパース（不正・空なら `undefined`）。
  - 選択 ID から `serviceNames` / `featureNames` / `targetNames` と `department`（診療科名の `・` 連結）を導出。
  - `generateSlug(clinicName)` で slug を生成し `saveHearing()` → `/mypage/requests` へ redirect。
- 送信後の修正手段はない（生成サイトの編集は可能）。

### 8.3 写真アップロード（`POST /api/uploads` → `src/app/api/uploads/route.ts`）

- `multipart/form-data`。`category`（`^[a-z0-9_-]{1,32}$`）と `files`（最大 10、各 8 MB 以下、
  MIME が `image/*`）。
- 拡張子は **MIME から**決定（`src/lib/imageFormats.ts` の `imageExtensionFor()`）。未対応形式は
  日本語エラー。
- 保存先キー: `clinc-hp/<category>/<uuid>.<ext>`。Supabase Storage に PUT（`x-upsert: true`）し、
  公開 URL を `{ urls: [...] }` で返す。
- フォームのカテゴリ（`src/lib/imageCategories.ts`）:
  | key | ラベル | 生成サイトでの用途 |
  |---|---|---|
  | `exterior` | 外部写真 | アクセス欄の外観・ヒーロー背景の予備 |
  | `interior` | 内部写真 | 院内ギャラリー |
  | `atmosphere` | 治療雰囲気写真 | 診療案内カード・院内ギャラリー |
  - 院長写真は `staff`、トップ画像は `hero` カテゴリで別途アップロードされる。
- Supabase 未設定時は 500（日本語）。

### 8.4 管理: マスタデータ（`src/lib/contentActions.ts`, `src/lib/content.ts`）

- `departments` / `services` / `features` / `targets` / `sections` の CRUD。全アクション冒頭で
  `requireAdmin()`、成功後に該当パスを `revalidatePath()`。
- `createDepartmentWithServices(name, serviceNames[])`: 新規診療科モーダルから診療科＋サービスを一括作成。
- ID は `crypto.randomUUID()`。

### 8.5 管理: リクエスト管理（`/admin/requests`）

- `listHearings()` で全件を新しい順に表示（クリニック名・申請者・送信日時・サイト・削除）。
- `deleteRequestAction(slug)`: `requireAdmin()` → `deleteHearing()`（無制限削除）。
- 各行に「サイト生成」ボタン（§8.6）。生成済みなら「編集」リンクと生成サイトのプレビュー URL。

### 8.6 サイト生成（`generateSiteAction` → `src/lib/buildSiteFromHearing.ts`）

管理者トリガの **同期・低速**（画像生成で数十秒）処理。`OPENAI_API_KEY` 必須。

1. **コピー＋構造**: `openaiJSON()` で 1 回の chat completion（`response_format: json_object`,
   `temperature 0.7`, `max_tokens 4000`, タイムアウト 90 秒）。システムプロンプトは医療広告的に
   不適切な断定を禁止し、シートにない固有事実（装置名・症例数・資格・受賞）の創作を禁止。
   欠損の電話／住所／予約 URL はダミー値。出力を `normalizeTemplate()` で完全な `SiteTemplate` に整形。
2. **事実の上書き**: シートに値があれば `contact.phone` / `address` / `reserveUrl` はモデル出力より
   優先。`schedule.rows` はそのまま反映。`director` の氏名・肩書きは verbatim、あいさつ文は
   空行区切りで段落化。
3. **写真**（`isStorageConfigured()` のときのみ AI 生成。優先順は アップロード → OpenAI → プレースホルダ SVG）:
   - `uploadPool` = `interior` + `atmosphere`、`exteriorPool` = `exterior`。
   - 院長ポートレート: `director.photoUrl` → staff 写真 → AI（`1024x1536`）
   - 院内ギャラリー: `uploadPool` → AI（`1536x1024`）
   - ヒーロー背景: `heroImageUrl` → `uploadPool` → AI（`1536x1024`）→ 装飾（null）
   - アクセスの外観: `exteriorPool` → AI（`1536x1024`）
   - 診療案内カード: 残りの `uploadPool` → AI（先頭 2 枚まで）
   - 画像は `images/generations`（`gpt-image-1`, base64 or URL, タイムアウト 120 秒）で生成し
     `generated/<slug>/<slot>-<uuid>.png` として Supabase にアップロード。
4. **書き出し**: `renderBundle(template)` の結果を `public/_generated/<slug>/` に全置換で書き込み。
5. `generateSiteAction` が `hearing.data.generatedSite`（`at`, `imagesGenerated`,
   `imagesFromUploads`, `template`）を `saveHearing()` で保存し `/admin/requests` を revalidate。
6. 戻り値: `{ ok, url: "/api/generated/<slug>/", imagesGenerated, imagesFromUploads, warnings[] }`。
   画像生成失敗は throw せず `warnings` に積んでプレースホルダで続行。

再生成すると既存バンドルと `generatedSite` を上書きする。

### 8.7 生成サイトの編集（`src/components/siteEditor/*`, `src/lib/generatedSiteEditor.ts`）

- 対象: 管理者 または その申請を出した `clinic_owner` 本人（`requireSiteEditAccess`）。
- `loadEditableSite(slug)`: `hearing.generatedSite.template` → なければバンドルの `template.json` を
  読み、`normalizeTemplate(..., { trustLayout: true })`（既存セクション集合を維持）。
  未生成なら `template: null` を返し、UI は「まだ作成されていません」を表示。
- 概要画面（`SiteEditorOverview`）: テーマ（配色 `--nj-*`、フォント、`fontScale` 0.9–1.15）と
  セクションの並び。セクション行をタップすると内容編集ページへ（保留中の変更は先に保存）。
- アクション（`src/lib/contentActions.ts`、いずれも OpenAI 非依存のものは即時）:
  - `saveGeneratedTemplateAction(slug, template)`: 正規化 → `writeBundle()` で再レンダリング →
    `generatedSite.template` / `editedAt` を保存 → `/admin/requests` と `/mypage/requests` を revalidate。
  - `regenerateSectionAction(slug, sectionId, template)`: OpenAI で 1 セクションのコピーを書き直し、
    更新後の `SiteTemplate` を返す（保存はエディタ側の判断）。レイアウトと他セクションは保持。
  - `generateImageAction(slug, kind, hint)`: `kind` = `portrait` | `interior` | `exterior`。
    OpenAI で 1 枚生成 → Supabase に保存 → URL を返す（テンプレへの反映と保存は別途）。
- 自由ブロック（`customBlocks`）: `text` / `image` / `grid` をエディタから挿入可能。`layout` から
  `id` で参照。CSS は `staticAssets.ts` の `custom.css`。

### 8.8 生成サイトの配信（`/api/generated/<slug>/[[...path]]` → route handler）

- `export const dynamic = "force-dynamic"`。`getSession()` が無ければ 401（＝サインインユーザなら誰でも閲覧可）。
- パストラバーサル防御: slug と各セグメントに区切り文字・`.` / `..` を許さず、解決後のパスが
  `ROOT/<slug>/` 配下（または `index.html`）であることを再確認。
- `public/_generated/` に置くのはビルド後・実行時に作られるファイルのため（`next start` はビルド時に
  存在した `public/` しか配信しない）。
- HTML はレスポンス時に `<head>` 直後へ `<base href="/api/generated/<slug>/">` を注入
  （バンドルは相対 URL を使うので、末尾スラッシュ有無で相対解決がずれるのを防ぐ）。
- 全レスポンスに `Cache-Control: no-store` と `X-Robots-Tag: noindex, nofollow`。

### 8.9 静的エクスポート（`scripts/export-static.mjs`, `npm run export`）

クライアントにプレーンなファイル一式を渡すための手順:

```bash
npm run build && npm run start          # 別ターミナル、port 3000
npm run export -- <slug>                # → public/_generated/<slug>/
npm run export -- --all                 # src/app/preview/* の全ディレクトリ
```

- 動いているサーバから `/preview/<slug>` を取得（`PREVIEW_BASIC_AUTH` を送信）、Next.js の
  アーティファクトを除去、Google Fonts の `<link>`（`data-nj-font` マーカーで発見）を CDN 参照として残す。
- **CSS / JS / HTML をセクション単位に分割**: `.nj-site` の CSS バンドルを `css/site.css`（トークン・
  リセット）/ `css/ui.css`（Container・SectionHeading）/ 使用セクションごとの `css/<section>.css` に
  分割（dev ビルドの per-file コメントマーカー、prod は `<Name>-module__` プレフィックスで判定）。
  `html/<section>.html` は各トップレベル `.nj-site` 子要素の生マークアップ（`<header>` メニューを前置）。
- `js/motion.js` は `public/nj-motion.js` をそのままコピー。`index.html` の `<link>` / `<script>` 順:
  fonts → site → ui → sections → motion.js。
- 出力（`public/_generated/`）は `.gitignore` 済み。

### 8.10 プレビュールートと Basic 認証プロキシ

- `/preview/<slug>/page.tsx`（`midori`, `nojima`）は §9.1 の手組みテンプレートを描画する。
  生成サイト（§8.6）とは別のコード。
- `src/proxy.ts` の Basic 認証は §6.3。

---

## 9. サイトのレンダリング（2 系統）

同じ「nj-site」デザイン DNA を、**異なるコード** で生成する 2 経路がある。

### 9.1 手組みテンプレート — `/preview/<slug>`（`/template-create` の成果物）

- `src/app/preview/<slug>/page.tsx` が `<div class="nj-site">` 配下に React セクション
  （`src/components/sections/<Name>/`＝`.tsx` + CSS Module）を描画。`registry.ts` の
  `type:variant` → コンポーネントで解決（未登録の組み合わせは描画しない）。
- コンテンツは 1 つの JSON: `src/components/sections/data/template.json`
  （スキーマ `template.schema.json`）。`meta` / `theme`（`colors` + `fonts`）/ `brand` / `contact` /
  `layout`（`{type, variant}[]`）/ `nav` / `sections.<name>`。画像スロット `{src, alt}`、`src: null` で
  組み込みプレースホルダ SVG。
- `data/template.ts` が型付けし `themeStyle`（`--nj-*` インライン）/ `fontHref` / `content` を公開。
  `data/{clinic,departments,sections}.ts` は薄い後方互換シム。
- 装飾はすべてインライン SVG（`ui/Illustration.tsx`）。
- 新しいサイトは `template.json` をコピーして値を編集するだけ（セクションコンポーネントに
  ハードコード文字列はない）。
- レジストリ登録: `header:bar`, `hero:full-bleed`, `schedule:table`, `news:list`, `reasons:numbered`,
  `greeting:portrait`, `philosophy:centered`, `medical:grid`, `fees:table`, `flow:steps`,
  `faq:accordion`, `access:map-side`, `contact:cta`, `footer:band`。

### 9.2 生成バンドル — `public/_generated/<slug>/`（ヒアリングシート由来）

- `src/lib/generatedSite/render.ts` が `SiteTemplate` を **文字列テンプレートで** ビルドし、
  ファイル一式（`index.html`, `css/*`, `js/site.js`, `html/*`, `assets/*`, `template.json`,
  `README.md`）を返す（`renderBundle()`）。
- CSS / JS は全サイト共通（`src/lib/generatedSite/staticAssets.ts`。`hidamari-hifuka` バンドルから
  自動生成。西宮の皮ふ科サイトを参照した「水彩のにじみ＋植物線画＋丸／筆書体」の DNA）。
  クリニックごとの差分はセクション HTML と `.nj-site` にインラインで置く `--nj-*` カスタムプロパティのみ。
- `SiteTemplate` の構造（`src/lib/generatedSite/types.ts`）:
  - `meta`, `theme`（`colors` 8 色 / `washes` 5 色 / `botanicalStroke` / `fonts` / `fontScale`）,
    `brand`, `contact`, `layout: {id, kind}[]`, `nav: {href, label}[]`, `sections`, `customBlocks`。
  - `sections`: `hero`, `greeting`, `medical`, `philosophy`, `gallery`, `schedule`, `fees`, `flow`,
    `faq`, `news`, `access`, `contact`, `footer`。
  - `KNOWN_SECTION_IDS` にない `layout` エントリはスキップ。
  - `medical.items[].icon` は `skin|child|sparkle|care|tooth|eye|bone|heart|allergy|general` のいずれか
    （`render.ts` の `ICON_INNER`）。
- `normalize.ts` の 3 つのガードレール:
  1. **コントラスト**: 淡すぎる配色を、見出し／ボタンが WCAG を満たすまで濃くする。
  2. **フォント**: Latin 専用フォント（Roboto 等）を日本語対応に差し替え、`googleHref` を再構築。
  3. **セクション**: ベースライン集合（greeting, medical, philosophy, schedule, flow, faq, access,
     contact）を常に出す（欠損は合成コピー）。`trustLayout: true` のときはこの追加を行わない。

### 9.3 モーション・装飾（両系統共通）

- `public/nj-motion.js`（依存なし、`<script src="/nj-motion.js" defer>`）: `IntersectionObserver` の
  スクロールリビール（`.nj-reveal` / `[data-nj-anim]` → `.is-visible`）、`[data-nj-count]` カウントアップ、
  ヘッダー影＋`.nj-progress` スクロールバー＋`[data-nj-parallax]`、スティッキーヘッダー分を差し引く
  アンカースクロール（`--nj-header-h`）、モバイルメニューを閉じる。スクロールスパイはなし。
- JS なしでも完全に描画される（メニューは CSS `:checked`）。`prefers-reduced-motion` でモーション無効。
- 純 CSS 装飾: `@keyframes nj-twinkle`（見出し脇の 4 点星 `.nj-spark`）、`@keyframes nj-float`、
  リビール時の `blur(6px)→0`。すべて `site.css` / `staticAssets.ts` 内で `prefers-reduced-motion` ガード。

---

## 10. Server Actions 一覧

| アクション | ファイル | 認可 | 効果 |
|---|---|---|---|
| `signupClinicOwnerAction` / `loginClinicOwnerAction` / `loginAdminAction` / `logoutAction` | `authActions.ts` | 公開 | 認証。redirect |
| `createApplicationAction` | `applicationActions.ts` | `clinic_owner` | ヒアリングシートを UPSERT → `/mypage/requests` |
| `deleteOwnApplicationAction(slug)` | `applicationActions.ts` | `clinic_owner`（本人） | 自分の申請を削除 |
| `createUserAction` / `deleteUserAction(id)` | `contentActions.ts` | `requireAdmin()` | ユーザー作成／削除 |
| `deleteRequestAction(slug)` | `contentActions.ts` | `requireAdmin()` | 申請を無制限削除 |
| `generateSiteAction(slug)` | `contentActions.ts` | `requireAdmin()` | OpenAI でサイト生成（§8.6） |
| `saveGeneratedTemplateAction(slug, template)` | `contentActions.ts` | 管理者 or 本人 | バンドル再レンダリング＋保存（OpenAI なし） |
| `regenerateSectionAction(slug, sectionId, template)` | `contentActions.ts` | 管理者 or 本人 | 1 セクションのコピーを OpenAI で再生成 |
| `generateImageAction(slug, kind, hint)` | `contentActions.ts` | 管理者 or 本人 | 画像 1 枚を OpenAI 生成 |
| `create/update/deleteDepartmentAction`, `...ServiceAction`, `...FeatureAction`, `...TargetAction`, `...SectionAction` | `contentActions.ts` | `requireAdmin()` | マスタ CRUD |

---

## 11. セキュリティ考慮

- Server Action は直接 POST 可能 → 認可は各アクション先頭（§6.2）。
- テナント分離: オーナー系の読み取りは SQL の `WHERE owner_email = ?` で絞る。削除は
  `ownerEmail === session.email` を再確認。
- 生成サイト配信・アップロードはサインイン必須。生成サイト配信はパストラバーサル二重チェック。
- OpenAI / D1 / Supabase の各キーはサーバ側でのみ読む（ブラウザに出さない）。
- OpenAI 出力は信用しない: `normalizeTemplate()` が全フィールドを整形し、`render.ts` の `esc()` /
  `emphasise()`（1 段階のみ）で HTML エスケープ。
- 全生成レスポンスに `noindex, nofollow`。
- `PREVIEW_BASIC_AUTH` はプレビューのゲートであり、アプリのログインの代替ではない。

---

## 12. デプロイ・運用

### 12.1 コマンド（`package.json` / `CLAUDE.md`）

```bash
npm run dev            # Next.js dev（Turbopack）
npm run build          # 本番ビルド（output: "standalone"）
npm start              # 本番ビルドを起動
npm run lint           # eslint
npx tsc --noEmit       # 型チェック
npm run clean          # rm -rf .next tsconfig.tsbuildinfo（Turbopack / route-type の stale 対策）
npm run export -- <slug>   # 静的バンドルの書き出し（§8.9）
npm run preview:tunnel     # cloudflared tunnel --url http://localhost:3000
npm run cf:dev / cf:deploy # wrangler dev / deploy

node scripts/migrate.mjs                       # migrations/*.sql を D1 HTTP API に適用
node scripts/migrate.mjs --file 0003_...sql    # 1 ファイルだけ適用
node scripts/seed-admin.mjs <email> <pw> [admin|clinic_owner]  # users への INSERT 文を出力
```

### 12.2 検証（テストフレームワークはない）

手動: `npx tsc --noEmit && npm run lint && npm run build` ＋ dev サーバでフロー実走。
データレベルの証明が要るときは scratchpad に使い捨てスクリプトを書き、実 D1 行に対してロジックを再現する。

### 12.3 初回 `wrangler deploy` の前に

1. デプロイ自体の認証: `wrangler login`（OAuth）か、シェルに `CLOUDFLARE_API_TOKEN` を設定
   （設定済みなら wrangler が自動使用し、`wrangler login` は上書きを拒否する）。
2. ランタイム秘密を `wrangler secret put` で設定: `CLOUDFLARE_ACCOUNT_ID`,
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID`, `OPENAI_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`（必要なら `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`）。
3. `wrangler deploy`（Dockerfile をビルド → イメージ push → Worker + Container デプロイ）。

---

## 13. 既知の制約・技術的負債

| 項目 | 内容 |
|---|---|
| コンテナディスク非永続 | `public/_generated/*` は再デプロイ／再起動で消える。生成元 `SiteTemplate` は D1 にあるのでエディタ「保存」で再レンダリング復旧可（§3.4）。恒久対応は出力を R2 等へ移すこと |
| テストなし | ランナー未導入。検証は手動（§12.2） |
| stale なコメント | `wrangler.jsonc` / `Dockerfile` / `worker/index.ts` のコメントに実在しないモジュール名（`renderSiteFiles.ts`, `cloudflareDeploy.ts` 等）や誤ったパス `public/generated`（実体は `public/_generated`）が残る。挙動ではなく文言の問題 |
| `ApplyForm.tsx` | 単一クライアントコンポーネントに約 1,200 行。全ステップの state を保持 |
| レンダリング 2 系統 | §9.1（React コンポーネント）と §9.2（文字列テンプレート）が別々に「nj-site」を生成する。CSS DNA は共有だがコードは重複気味 |
| `hours` / `staffMembers` | レガシーフィールド。新フォームは構造化 `schedule` と単一 `director` のみ入力 |
| 申請の更新パスなし | 送信後の内容修正は不可（設計）。生成サイトのみ編集可 |

---

## 14. ディレクトリ早見表

```
src/
  proxy.ts                     プレビュー用 Basic 認証（旧 middleware.ts）
  app/
    page.tsx                   公開ランディング
    login/ signup/ admin/      認証画面
    home/ mypage/**            clinic_owner の画面（申請・一覧・サイト編集）
    admin/(dashboard)/**       admin の画面（users / requests / マスタ / サイト編集）
    api/uploads/route.ts       写真アップロード → Supabase Storage
    api/generated/[slug]/[[...path]]/route.ts   生成バンドルの配信
    preview/<slug>/page.tsx    手組みテンプレートの React 描画
  lib/
    d1.ts                      D1 HTTP クライアント（1 リクエスト 1 文）
    auth.ts authActions.ts     scrypt / session / requireAdmin
    content.ts contentActions.ts  マスタ CRUD ＋ 生成／編集アクション
    hearing.ts applicationActions.ts  ヒアリングシート永続化 ＋ 申請アクション
    openai.ts                  OpenAI REST（chat / images）
    supabaseStorage.ts         Supabase Storage REST
    buildSiteFromHearing.ts    ヒアリングシート → 生成バンドル（§8.6）
    generatedSiteEditor.ts     エディタ用ローダ
    imageCategories.ts imageFormats.ts
    generatedSite/
      types.ts                 SiteTemplate 型
      normalize.ts             生 JSON → 完全な SiteTemplate（3 ガードレール）
      render.ts                SiteTemplate → 静的ファイル一式
      staticAssets.ts          全サイト共通の CSS / JS / SVG
      color.ts fonts.ts        コントラスト補正・フォント解決
  components/
    apply/ApplyForm.tsx        申請ウィザード
    siteEditor/**              生成サイトのエディタ
    sections/**                手組みテンプレートの React セクション ＋ registry.ts
    sections/data/template.json  手組みテンプレートのコンテンツ
    landing/** ui/** admin/** mypage/** auth/**
migrations/    0001 auth / 0002 content / 0003 hearings / 0004 sections
scripts/       migrate.mjs / seed-admin.mjs / export-static.mjs
worker/        index.ts（Cloudflare Container のフロントドア）
Dockerfile wrangler.jsonc next.config.ts
```
