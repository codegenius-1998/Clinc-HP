import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import { HONESTY_RULES, MEDICAL_AD_GUIDELINE_RULES } from "@/lib/site/authoringRules";
import { blockLabel, extractBlockTexts } from "@/lib/site/blocks";
import type { Block } from "@/lib/site/document";

/** Rewrites the text of ONE block to a user's instruction ("もっと親しみやすく", "3行に縮めて").
 *
 * Deliberately block-scoped rather than page-wide. A whole-page rewrite is one prompt whose blast
 * radius is the entire site: a single bad generation replaces copy the clinic already approved, and
 * the user has no way to tell which of thirty changes was the wrong one. Scoped to a block, the
 * before/after is small enough to actually read, and a bad result costs one undo.
 *
 * Returns edits; writes nothing. The caller applies them to its in-memory document, so the user still
 * has to press 保存 — an AI rewrite is never persisted behind their back. */

export type BlockRewrite = {
  note: string;
  edits: { path: string; label: string; before: string; after: string }[];
};

const resultSchema = z.object({
  /** One sentence, in Japanese, on what was changed — shown above the diff. */
  note: z.string(),
  edits: z.array(
    z.object({
      path: z.string(),
      value: z.string(),
    })
  ),
});

function buildSystemPrompt(): string {
  return `あなたは日本のクリニックのホームページ原稿を編集する、医療広告に詳しい日本語コピーライターです。
渡された「1つのセクションの現在の文章」を、ユーザーの指示どおりに書き直してください。

# 絶対に守ること
${HONESTY_RULES.map((r) => `- ${r}`).join("\n")}
- path は、渡された一覧にあるものだけを使う。存在しない path を作らない。
- 指示に関係のない項目は edits に含めない（変更しないものは返さない）。
- HTMLタグ・Markdown記法を出力しない。プレーンテキストのみ。
- 元の文章に無い事実（診療実績、資格、設備名、価格、時間など）を新たに足さない。言い回しだけを変える。
- 文字数は元の文章と大きく変えない。指示に「短く」「長く」とある場合のみ変える。

# 医療広告ガイドライン（触れる表現は書かない）
${MEDICAL_AD_GUIDELINE_RULES.map((r) => `- ${r}`).join("\n")}

# 出力
- note には、何をどう変えたかを日本語1文で書く。
- 指示が現在の文章に対して意味をなさない場合は、edits を空配列にし、note にその理由を書く。`;
}

function buildUserPrompt(block: Block, excerpts: { path: string; label: string; value: string }[], instruction: string): string {
  const lines = excerpts.map((e) => `- path: ${e.path}\n  項目: ${e.label}\n  現在の文章: ${e.value}`).join("\n");
  return `# セクションの種類
${blockLabel(block.type)}${block.navLabel ? `「${block.navLabel}」` : ""}

# 書き換えられる項目
${lines}

# ユーザーの指示
${instruction}`;
}

/** The model is told to emit plain text, but occasionally emits a stray tag anyway (a literal "<br>"
 * used as a line-break hint has been seen in practice). Block data is rendered as plain React text,
 * so this is a legibility fix, not an XSS one — the tag would otherwise appear verbatim on the page. */
function stripTags(value: string): string {
  return value.replace(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/gi, "").trim();
}

const MAX_VALUE_LENGTH = 2000;

export async function rewriteBlockText(block: Block, instruction: string): Promise<BlockRewrite> {
  const excerpts = extractBlockTexts(block);
  if (excerpts.length === 0) {
    return { note: "このセクションにはAIが書き換えられる文章がありません。", edits: [] };
  }

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(block, excerpts, instruction) },
    ],
    text: { format: zodTextFormat(resultSchema, "block_rewrite") },
  });

  const parsed = response.output_parsed as z.infer<typeof resultSchema> | null;
  if (!parsed) throw new Error("AIの書き換えに失敗しました。");

  // Only paths the block actually has are allowed through — a hallucinated path would otherwise be
  // written into `data` by setFieldValue and become a field nothing renders and no form can remove.
  const byPath = new Map(excerpts.map((e) => [e.path, e]));
  const edits: BlockRewrite["edits"] = [];
  for (const edit of parsed.edits) {
    const source = byPath.get(edit.path);
    if (!source) continue;
    const after = stripTags(edit.value).slice(0, MAX_VALUE_LENGTH);
    if (!after || after === source.value) continue;
    edits.push({ path: edit.path, label: source.label, before: source.value, after });
  }

  return { note: parsed.note, edits };
}
