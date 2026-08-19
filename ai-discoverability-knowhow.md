# AI Service 発見性(Agent Readiness) Know-how

- 対象読者：本プロジェクトの開発・運用担当者
- 最終更新：2026-08-19
- 目的：Claude / ChatGPT / Perplexity 等の AI エージェントが飲食店HPを**見つけ・理解し・操作できる**ようにするための実装知見の整理
- 仕様ソース：[skills/agent-readiness.md](../skills/agent-readiness.md)
- 実装ソース：[shared-foundation/workers/store-renderer/src/seo.ts](../shared-foundation/workers/store-renderer/src/seo.ts) / [.../src/index.ts](../shared-foundation/workers/store-renderer/src/index.ts)

---

## なぜ重要か

```
[従来のWeb]        人間 → 検索エンジン(Google) → サイト
[Agentic Web 時代]  人間 → AIエージェント → サイト
```

AIエージェントはユーザーに代わって「予約する」「店舗情報を要約する」「複数店舗を比較する」。
**AIに正しく理解されないHPは「存在しない」のと同じ**になる。

判定基準は Cloudflare の [`isitagentready.com`](https://isitagentready.com)。5カテゴリで100点を目指す：

| カテゴリ | 配点 | 必須実装 |
|---|---|---|
| Discoverability | 25 | robots.txt(AI bot対応)、sitemap.xml、Link Headers(RFC 8288) |
| Content Accessibility | 25 | Markdown for Agents、JSON-LD、適切な見出し構造 |
| Bot Access Control | 20 | AI bot 別の Allow/Disallow |
| Protocol Discovery | 20 | llms.txt、MCP Server Card、Agent Skills index、OAuth discovery |
| Commerce | 10 | 予約API・メニューAPIの公開（任意・将来） |

---

## AIが「よく探す」ために置くべきファイル一覧と現状

すべて店舗ごとに静的生成せず、**Cloudflare Workers（store-renderer）で D1 データから動的生成**。コア更新1回で全店舗に即時反映される。

| パス | 役割 | 実装状況 |
|---|---|---|
| `/robots.txt` | AI bot 別 Allow ルール（GPTBot / ClaudeBot / PerplexityBot 等） | ✅ 実装済み |
| `/sitemap.xml` | サイトマップ（トップ・メニュー・アクセス・お知らせ） | ✅ 実装済み |
| `/llms.txt` | LLM向け店舗要約（[llms.txt仕様](https://llmstxt.org)準拠） | ✅ 実装済み |
| `/llms-full.txt` | より詳細版 | ⚠️ ルートはあるが中身は `/llms.txt` と同一関数を返しているだけ（詳細版の差別化なし） |
| `/index.md` `/menu.md` `/access.md` | 各ページの Markdown for Agents 版 | ✅ 実装済み（3ページのみ） |
| `/structured-data.json` | Restaurant スキーマ JSON-LD | ✅ 実装済み |
| `/.well-known/ai-plugin.json` | OpenAI Plugin 仕様 | ✅ 実装済み（`api.url` が指す `/.well-known/openapi.json` は未実装＝リンク切れ） |
| `/.well-known/agent-skills/index.json` | Agent Skills 一覧 | ✅ 実装済み（4スキル：get_store_info / get_menu / get_access / make_reservation） |
| `/.well-known/agent-skills/{skill}.md` | 各スキルの詳細手順 | ❌ 未実装（index.jsonのurlが指す個別mdファイルなし） |
| `/.well-known/llms.txt` `/.well-known/llms-full.txt` | llms.txt の `.well-known/` 標準パス | ❌ 未実装（ルート直下のみ） |
| `/.well-known/mcp.json`（MCP Server Card） | AIエージェントが直接ツール呼び出しできるMCPサーバーの案内 | ❌ 未実装 |
| HTTP `Link` ヘッダー(RFC 8288) | `rel="describedby"` 等でAI向けリソースを応答ヘッダーで案内 | ⚠️ 一部実装：`llms.txt` と `structured-data.json` のみ。`sitemap` / `agent-skills` / `mcp` は未付与 |

> ⚠️ = 仕様上は必須だが実装が仕様どおりでない／不完全。❌ = 未実装。Agent Readiness スコアを伸ばす余地はこの3行。

---

## 各ファイルの要点

### robots.txt — AI bot を明示的に許可する

デフォルト拒否ではなく、**主要AI botを名指しでAllowする**のが肝。まとめて `User-agent: *` に頼ると学習用クローラ（GPTBot等）だけ個別ブロックされているケースを誤検知されやすい。

実装済みリスト（[seo.ts:15](../shared-foundation/workers/store-renderer/src/seo.ts#L15)）：GPTBot / ChatGPT-User / OAI-SearchBot / ClaudeBot / Claude-Web / anthropic-ai / Google-Extended / PerplexityBot / CCBot / Applebot-Extended / DuckAssistBot / meta-externalagent

`status !== 'published'`（demo/draft/expired/paused）の店舗は **全bot拒否**にして未公開情報の流出を防ぐ設計。

### llms.txt — AIが最初に読む「店舗の要約」

[llmstxt.org](https://llmstxt.org) 仕様に沿い、Markdown形式で「店舗情報 → 予約方法 → おすすめメニュー → サイトマップ → エージェント向け補助エンドポイント」の順に構成。AIはここを起点に必要なページだけをピンポイントで取得しにいく（HTML全体をクロールするより低コストで正確）。

### Markdown for Agents（`/index.md` 等）

同一内容のHTML/Markdown 2版を用意することで、AIはレンダリング不要な軽量フォーマットを直接取得できる。SPA的な装飾HTMLよりMarkdownの方がトークン効率・正確性ともに高い。

### 構造化データ（JSON-LD Restaurant スキーマ）

`openingHoursSpecification` / `hasMenu` / `acceptsReservations` など schema.org 語彙で機械可読化。将来的に `potentialAction: ReserveAction` を足せば「AIが直接予約フローをトリガーする」動線を示せる（現状 [seo.ts](../shared-foundation/workers/store-renderer/src/seo.ts) では未実装）。

### Agent Skills / MCP — AIに「できること」を教える

`agent-skills/index.json` はAIエージェントに対して「このサイトで実行可能な操作」のカタログを渡す仕組み。将来 MCP Server Card（`.well-known/mcp.json`）を追加すれば、AIがツール呼び出しプロトコルで直接メニュー取得・空席確認までできるようになる（Commerce カテゴリの10点に直結）。

---

## 実装ギャップを埋める優先順位（次にやるなら）

1. **Link ヘッダーの拡充**（[index.ts:1020](../shared-foundation/workers/store-renderer/src/index.ts#L1020)）— `sitemap` / `agent-skills` / `mcp` の `rel` を追加。実装コストが最小でDiscoverabilityスコアに直結
2. **`.well-known/ai-plugin.json` のリンク切れ解消** — `openapi.json` を実装するか、参照を外す
3. **各 agent-skill の詳細 Markdown**（`make-reservation.md` 等）— `index.json` から参照されているのに実体がない状態を解消
4. **`llms-full.txt` の差別化** — 現状 `llms.txt` と同一内容。全メニュー・全お知らせを含むフル版にする
5. **MCP Server Card** — Commerce カテゴリ（10点）の将来対応

---

## 検証方法

```bash
# isitagentready.com で自動チェック
curl https://isitagentready.com/api/scan?url=https://{store_id}.yurulica.net

# 各エンドポイントの目視確認
curl https://{store_id}.yurulica.net/robots.txt
curl https://{store_id}.yurulica.net/llms.txt
curl https://{store_id}.yurulica.net/.well-known/agent-skills/index.json
curl -I https://{store_id}.yurulica.net/ | grep -i '^link:'
```

QAチェックリストの「11. QA最終確認」シートで isitagentready.com スコア 90以上（100目標）を必須項目化している（[CLAUDE.md](../CLAUDE.md) AI対策セクション）。

---

## 関連ドキュメント

- [skills/agent-readiness.md](../skills/agent-readiness.md) — フル仕様（100点達成チェックリスト・全ファイルのテンプレート）
- [infrastructure-overview.md](infrastructure-overview.md) — Auth/DB/Hosting/Storage
- [shared-foundation-architecture.md](shared-foundation-architecture.md) — 3層分離アーキテクチャ
