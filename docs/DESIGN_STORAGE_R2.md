# 設計書：生成サイトの保存先を R2 へ

**状態**：設計のみ。実装は未着手。
**前提**：デプロイ先は **Cloudflare**（Vercel ではない）。ストレージは **R2**（未契約・今後導入）。
**関連**：[SPEC.md](./SPEC.md) 12.5（ヒアリングシートの D1 移行）、13.2（永続化の課題）

---

## 1. なぜやるのか

ヒアリングシートは D1 に移りました。ローカルディスクに残っているのは **生成サイト（`public/generated/`）だけ**です。

| | 容量 | ファイル数 |
|---|---|---|
| 生成サイト 7件 | 18MB | — |
| テンプレート 4件 | 7.7MB | — |
| **合計** | **26MB** | **172** |

### ⚠️ Cloudflare Containers のディスクは永続しません

これは設定の問題ではなく、プラットフォームの仕様です（公式ドキュメント：*Disk persistence: None*／*Persistent identity, ephemeral disk*）。**コンテナが停止・再起動・再デプロイされた時点で `public/generated/` は消えます。**

現在の [wrangler.jsonc](../wrangler.jsonc) はこれを承知のうえで、

- `max_instances: 1`（2台目ができると別々のディスクを持ってしまうため）
- `sleepAfter: "24h"`（寝かせるとディスクが消えるため）

という**「1台を絶対に寝かせない」構成**で回避しています。これは、

1. **スケールできない** — 2台目を許した瞬間に、どちらに当たるかでサイトが見えたり見えなかったりする
2. **落ちたら消える** — 再デプロイ、OOM、Cloudflare 側の再配置、どれでも失われる

### ⚠️ 失われて困るのは画像です

1サイトを実測した内訳：

| | 容量 | 割合 |
|---|---|---|
| 画像 25枚 | 4.00MB | **98.0%** |
| index.html + css + js | 0.08MB | 2.0% |

HTML・CSS・JS は **D1 の SiteDocument から無料で再生成できます**（`npm run render:sites -- --all`）。問題は残りの98%です。

| 画像の種類 | 消えたときの復旧 |
|---|---|
| AI が生成した画像 | ⛔ **もう一度課金して作り直すしかない**。しかも同じ絵は二度と出ない |
| クリニックがアップロードした写真 | ✅ Supabase Storage の URL がヒアリングシート（D1）に残っているので復元可 |

**つまり、いま守られていない資産は「AIが生成した画像」です。** ここが移行の主目的です。

---

## 2. 前提として押さえた制約

公式ドキュメントおよびリポジトリ実測で確認した事実です。

### コンテナ

| 項目 | 値 | 設計への影響 |
|---|---|---|
| ディスク永続性 | **なし** | 本設計の出発点 |
| ディスク上限 | 20GB（一時利用は可） | 公開時の一時展開には十分 |
| コールドスタート | 2〜3秒 | 許容 |
| `sleepAfter` の基準 | **リクエストの有無**であり、内部処理の有無ではない | ⚠️ 後述 |
| 停止時の猶予 | SIGTERM から15分 | 生成中の停止は救えない可能性あり |
| 提供状態 | **beta**（SLA なし・API 変更あり） | 本番採用の判断材料として明記 |

### ⚠️ コンテナは binding を受け取れません

Cloudflare の binding（`env.MY_BUCKET` のような直結オブジェクト）は **Worker が持つもの**で、コンテナに渡せるのは**環境変数だけ**です（[worker/index.ts](../worker/index.ts) の `envVars` がまさにそれ）。

したがってコンテナ内の Node からは **S3 互換 API をアクセスキーで叩く**ことになります。これは、このアプリが D1 を Workers binding ではなく **REST API 経由**で使っているのと**まったく同じ構図**です（[src/lib/d1.ts](../src/lib/d1.ts) 冒頭のコメント参照）。新しい考え方は要りません。

**結論：書き込みはコンテナから S3 API、読み出しは Worker から binding。** 役割が違うので両方が要ります。

---

## 3. R2 に何をどう置くか

### バケットとキー設計

バケットは **1つ**（例：`clinc-hp`）。プレフィックスで用途を分けます。

```
sites/<slug>/index.html
sites/<slug>/css/site.css
sites/<slug>/js/main.js
sites/<slug>/images/<name>.jpg
templates/<templateId>/index.html
templates/<templateId>/images/<name>.jpg
uploads/<category>/<uuid>.<ext>        ← 第4段階（Supabase から移す場合）
```

現在のディレクトリ構成（`public/generated/<slug>/` と `public/generated/_templates/<id>/`）をそのまま写した形です。`_templates` という予約名で衝突を避けていた工夫は、プレフィックスが別なので不要になります。

### ⚠️ 再生成できるものとできないものを、削除ポリシーで分ける

同じプレフィックスの下に置きますが、**扱いは分けます**。

| 対象 | 上書き | 一括削除 |
|---|---|---|
| `index.html` / `css/` / `js/` | 保存のたびに上書き | してよい（D1から再生成可） |
| `images/` | 生成時のみ | ⚠️ **生成の全体やり直し以外では絶対に消さない** |

これは現在のコードがすでに守っている区別です（[renderSiteFiles.ts](../src/lib/render/renderSiteFiles.ts) は出力先を消さない、[siteGenerator.ts](../src/lib/siteGenerator.ts) だけが `rm(outDir)` する）。**その区別を R2 側にも持ち込むこと。** 混ぜると、編集画面で保存しただけで全画像が消えます。

---

## 4. 設計の中心：`SiteFileStore` という1つの入口

### いまディスクを触っている場所

| 場所 | していること |
|---|---|
| [renderSiteFiles.ts](../src/lib/render/renderSiteFiles.ts) | `index.html` / `css` / `js` / `placeholder.svg` を書く |
| [siteGenerator.ts](../src/lib/siteGenerator.ts) | `rm(outDir)` → 画像を書く |
| [designCheck.ts](../src/lib/site/designCheck.ts) | `existsSync` で画像の実在を確認 |
| [renderCheck.ts](../src/lib/site/renderCheck.ts) | `file://` で `index.html` を開く |
| [cloudflareDeploy.ts](../src/lib/cloudflareDeploy.ts) | ディレクトリのパスを `wrangler` に渡す |
| Next.js の静的配信 | `public/generated/**` をそのまま配る |

**6か所です。** ヒアリングシートの D1 移行が6関数だけで済んだのと同じ規模感で、同じやり方が使えます — **インターフェースを1本立て、呼び出し側は変えない**。

### インターフェース

```ts
// src/lib/site/fileStore.ts（新規）
export interface SiteFileStore {
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  /** 生成のやり直しでのみ使う。編集の保存では呼ばない。 */
  deletePrefix(prefix: string): Promise<void>;
  /** 閲覧用のURL（`/generated/...`）。R2のキーそのものではない。 */
  publicUrl(key: string): string;
}
```

実装は2つ。

| 実装 | 使いどころ |
|---|---|
| `LocalFileStore` | ローカル開発。**いまの挙動と1バイトも変わらない** |
| `R2FileStore` | 本番（コンテナ）。S3 API |

切り替えは環境変数の有無で自動判定します（`SUPABASE_URL` の有無で挙動が変わる [supabaseStorage.ts](../src/lib/supabaseStorage.ts) の `isStorageConfigured()` と同じ流儀）。**ローカル開発で R2 の契約を要求しないこと** — 開発の敷居を上げると誰も動かさなくなります。

### S3 クライアントに何を使うか

| 選択肢 | 評価 |
|---|---|
| **`aws4fetch`**（約5KB） | ✅ **推奨**。SigV4 署名だけを足した `fetch` ラッパー。「SDKを使わず素のRESTを叩く」という [supabaseStorage.ts](../src/lib/supabaseStorage.ts) の方針と一致する |
| `@aws-sdk/client-s3` | 機能は十分だが依存が重い。ここで必要なのは PUT / GET / LIST / DELETE の4つだけ |
| 自前で SigV4 を実装 | ⛔ 非推奨。署名は間違えても静かに 403 になるだけで、デバッグが割に合わない |

⚠️ **`region: "auto"` を必ず指定すること。** R2 はリージョンを持ちませんが、S3 の署名にはリージョン文字列が要ります。指定を忘れると**全リクエストが認証エラー**になります（公式 gotcha）。

---

## 5. 配信経路：Worker が読み、コンテナが書く

現在、Worker は**すべてのリクエストをコンテナへ素通し**しています。ここに分岐を1つ入れます。

```
ブラウザ ──▶ Worker ──┬── /generated/*  ──▶ R2 binding から直接返す
                      └── それ以外       ──▶ コンテナ（Next.js）
```

この形にする理由：

- **速い**：画像がコンテナを経由しない。Next.js の静的配信を通す意味がない
- **安い**：R2 は**エグレス無料**
- **コンテナが寝ても配信は続く**：静的サイトの閲覧がコンテナの生死に依存しなくなる ⚠️ **これは副次的な効果ではなく、`sleepAfter: "24h"` をやめられる条件そのものです**

### ⚠️ Worker 側の必須事項

R2 の公式 gotcha として明記されているものです。

| 項目 | 内容 |
|---|---|
| キー検証 | `..` を含む、`/` で始まるキーを**必ず弾く**。URLパスをそのままキーにしない（パストラバーサル） |
| ETag | `object.etag` ではなく **`object.httpEtag`**（引用符つき）を使う。素の方はヘッダとして不正 |
| 404 | オブジェクト無しと、条件付きリクエストの 304 を区別する（`object` が null か、`object.body` が無いか） |
| キャッシュ | `Cache-Control` を付ける。画像は長め、`index.html` は短め（編集後すぐ反映されてほしい） |

---

## 6. 公開（Cloudflare Pages）はどうなるか

現在の [cloudflareDeploy.ts](../src/lib/cloudflareDeploy.ts) は `npx wrangler pages deploy <ディレクトリ>` を子プロセスで叩いています。**これが Pages の「Direct Upload」そのもの**なので、方式を変える必要はありません。問題は「ディレクトリが要る」ことだけです。

**方針：公開の直前に、R2 から一時ディレクトリへ書き出して `wrangler` に渡す。**

```
公開ボタン → R2 から sites/<slug>/** を /tmp/publish-<slug>/ へ展開
          → wrangler pages deploy /tmp/publish-<slug>
          → 一時ディレクトリを削除
```

⚠️ **一時ディスクを使うことは、この設計と矛盾しません。** 「消えては困るものをディスクに置かない」のが方針であって、**消えてよいものを一時的に置くのは正しい使い方**です（20GB あり、1サイト4MB）。

`wrangler` はすでに Dockerfile でグローバル導入済みなので、この部分の変更は「ディレクトリを作る処理を足す」だけです。

**代替案**：各クリニックのサイトを Workers Static Assets として公開する方法もあります。ただし現行の Pages 経路は動いており、置き換える利得が小さいため**今回は採りません**。

---

## 7. アップロード画像（Supabase → R2）をどうするか

### ⚠️ まず、方針の変更を明記します

[CLAUDE.md](../CLAUDE.md) には現在こう書かれています。

> **Supabase Storage**: … (R2 was removed — do not reintroduce it.)

**本設計はこの記述を意図的に覆すものです。** 実装に着手する段階で、CLAUDE.md を「R2 が正、Supabase は移行元」に**必ず書き換えてください**。古い注意書きが残っていると、次に触る人（や AI）が正しい実装を差し戻します。

### 判断

| | 寄せる | 寄せない |
|---|---|---|
| 利点 | 保存先が1つ。認証情報が1組。Supabase 依存が消える | 変更が小さい。いま動いているものを触らない |
| 欠点 | `POST /api/uploads` と画像取り込み経路を書き換える | 保存先が2つのまま。⚠️ D1とファイルで実際にズレが起きた前例がある |

**推奨：第4段階として、生成サイトの移行が終わってから寄せる。** 順序が逆だと、動作確認したいものが2つ同時に変わります。

なお現在、`site-images` バケットは anon ロールに INSERT を許可するポリシーが入っています（[SPEC.md](./SPEC.md) 13.9）。**R2 に寄せればこの穴も同時に閉じます** — R2 のアクセスキーはサーバー側にしか存在しないためです。

---

## 8. 段階分け

各段階の終わりに `npm run check:design -- --all` が通ることを条件にします。**この検査があるからこそ、保存先を差し替えても壊れていないと言い切れます。**

| 段階 | 内容 | R2 契約 | 動作の変化 |
|---|---|---|---|
| **A** | `SiteFileStore` を立て、6か所を通す。実装はローカルのみ | 不要 | **なし**（挙動は完全に同一であるべき） |
| **B** | `R2FileStore` を実装。Worker に `/generated/*` 分岐。既存26MBの投入スクリプト | 必要 | 配信元が R2 に変わる |
| **C** | 公開経路を「R2 → 一時ディレクトリ → wrangler」に | 必要 | なし（見た目上） |
| **D** | アップロードを Supabase → R2。CLAUDE.md 更新 | 必要 | Supabase 依存が消える |

### 段階 A を独立させる理由

**R2 の契約前に、変更の大半を検証できるからです。** A が終わった時点で「ディスクを直接触るコードは1つも残っていない」状態になり、B は実装を1つ足すだけになります。逆にまとめてやると、不具合が「抽象化の失敗」なのか「R2の使い方の誤り」なのか切り分けられません。

### 段階 B 完了後に、はじめて可能になること

```jsonc
// wrangler.jsonc
"max_instances": 1,        // → 増やせる
"sleepAfter": "24h",       // → 短くできる（コスト削減）
```

⚠️ **ただし、`sleepAfter` を短くする前に必ず次の項を読むこと。**

---

## 9. ⚠️ 落とし穴

### ⚠️ `sleepAfter` は「リクエストの有無」で判定される

公式の gotcha として明記されています。**内部で走っている処理は考慮されません。**

このアプリの生成は `void runGeneration(slug)` で切り離され、**4分間まったくリクエストが来ません**。`sleepAfter` を4分より短くすると、**生成の途中でコンテナが寝ます**。

対策：生成中は Durable Object のストレージを定期的に触って活動を延命する。

```ts
const keepAlive = setInterval(() => ctx.storage.put("keepalive", Date.now()), 60_000);
try { await generate(); } finally { clearInterval(keepAlive); }
```

⚠️ **これは段階 B で `sleepAfter` を短くするときの必須条件**です。忘れると「たまに生成が途中で止まる」という、最も再現しにくい種類の不具合になります。

### ⚠️ ストリームは長さが不明だと黙って切れる

R2 は PUT に長さを要求します。長さ不明のストリームを渡すと**エラーにならずに途中で切れます**。画像をバッファに読んでから渡すか、`Content-Length` を明示すること。1枚あたり数百KBなので、バッファで問題ありません。

### ⚠️ `list` は件数ではなく `truncated` で回す

1リクエスト最大1000件。`deletePrefix` は現在の `rm(outDir, {recursive:true})` の置き換えなので、**ページングを忘れると消し残ります**。一括削除も1000キーずつです。

### ⚠️ 2台目を許す前に、ディスク前提のコードが残っていないこと

`max_instances` を増やすのは**段階 B の完了後**です。1つでも `writeFile` が残っていると、「どちらのコンテナに当たったかでサイトが見えたり見えなかったりする」という切り分け困難な障害になります。段階 A で `SiteFileStore` に一本化しておくのは、そのための保険でもあります。

### ⚠️ Containers は beta

SLA がなく、API が予告なく変わりえます。**現時点でこれは既知のリスクとして受け入れる**という判断を、記録として残します。

---

## 10. 費用

R2 は **エグレス（転送量）が無料**です。かかるのはストレージと操作回数のみ。

| 規模 | 容量 |
|---|---|
| 現在（7サイト＋4テンプレート） | 26MB |
| 1サイトあたり | 約 3.5〜4MB |
| 100院 | 約 400MB |
| 1000院 | 約 4GB |

**1000院でも数GBです。** OpenAI の画像生成費用に比べれば無視できる水準で、費用は判断材料になりません。

---

## 11. やらないこと

**Workers への全面移植はしません。**

Workers はリクエスト単位で動くため、`void runGeneration(slug)` の**4分間のバックグラウンド処理が成立しません**。移すなら Queues か Workflows への作り替えが必要で、生成パイプライン全体の再設計になります。

現在のコンテナ構成は「既存の Node コードをそのまま動かす」ための選択であり、**ディスクの永続性さえ解決すれば、この選択は正しいまま**です。本設計はその1点だけを直します。

---

## 12. 検証方法

| 段階 | 確認 |
|---|---|
| A | `npm run render:sites -- --all` と `npm run check:design -- --all` が、移行前と**同じ結果**になること |
| B | 既存26MBを投入 → `/generated/<slug>/index.html` が Worker 経由で開ける → **コンテナを再起動してもサイトが消えない**（これが移行の成否そのもの） |
| B | 画像のパスが1つも壊れていないこと（`check:design` の `image-missing` / `render-broken-image` が 0） |
| C | 公開ボタン → `*.pages.dev` が開ける。一時ディレクトリが残っていない |
| D | 申請フォームから写真をアップロード → 生成 → その写真がサイトに出る |

⚠️ **段階 B の「コンテナを再起動してもサイトが消えない」を実際に試すこと。** これを確認しない限り、移行できたとは言えません。
