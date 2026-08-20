import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import { MEDICAL_AD_GUIDELINE_RULES } from "@/lib/site/authoringRules";
import { blockLabel, extractBlockTexts } from "@/lib/site/blocks";
import type { SiteDocument } from "@/lib/site/document";

/** Checks a clinic site's actual on-page text against Japan's medical advertising guideline (医療法
 * based規制 on 医業・歯科医業・病院等の広告). This is judgement, not pattern matching — whether a claim
 * counts as 誇大広告 or a photo needs an accompanying explanation depends on context a keyword scan
 * can't weigh — so, like generateContentPlan, this is a model call with a structured result rather
 * than a rule engine. Read-only: nothing here writes to the document. */

export type GuidelineIssue = {
  location: string;
  quote: string;
  reason: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
};

export type GuidelineCheckResult = {
  ok: boolean;
  summary: string;
  issues: GuidelineIssue[];
};

const issueSchema = z.object({
  location: z.string(),
  quote: z.string(),
  reason: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  suggestion: z.string(),
});

const resultSchema = z.object({
  ok: z.boolean(),
  summary: z.string(),
  issues: z.array(issueSchema),
});

function buildSystemPrompt(): string {
  return `あなたは日本の医療広告規制（医療法に基づく、医業・歯科医業・病院又は診療所に関する広告のガイドライン）に精通した審査担当者です。
渡されたクリニックのホームページ掲載文を読み、広告として問題になりうる箇所を指摘してください。

# 主な確認観点
${MEDICAL_AD_GUIDELINE_RULES.map((r) => `- ${r}`).join("\n")}

# 出力方針
- 明確に問題となる、または問題になりうる表現のみを issues に列挙する。過度に細かい言葉尻の指摘はしない。
- quote には該当箇所の原文をそのまま引用する（要約・改変しない）。
- reason には、上記のどの観点に触れるかを分かりやすい日本語で説明する。
- suggestion には、事実を保ったまま表現をどう直せば良いかの具体案を書く。
- 問題が1件も無い場合は issues を空配列にし、ok は true にする。1件でもあれば ok は false。
- severity は、明確な規制違反になりうるものを high、文脈次第で問題になりうるものを medium、より安全な表現にしたほうがよい程度のものを low とする。
- summary には、全体としてどの程度の状態かを1〜2文で書く。`;
}

function buildUserPrompt(excerpts: { location: string; value: string }[]): string {
  return excerpts.map((e) => `[${e.location}]\n${e.value}`).join("\n\n");
}

/** Gathers every piece of patient-facing text on the page, tagged with a human-readable location so a
 * flagged issue can point back to where it lives — the block's type/nav label plus the field, and the
 * SEO title/description (also patient-facing, via search results). Hidden blocks are skipped: text a
 * visitor can never see isn't an advertisement. */
function collectExcerpts(doc: SiteDocument): { location: string; value: string }[] {
  const out: { location: string; value: string }[] = [];
  for (const block of doc.blocks) {
    if (!block.visible) continue;
    const label = blockLabel(block.type) + (block.navLabel ? `「${block.navLabel}」` : "");
    for (const excerpt of extractBlockTexts(block)) {
      out.push({ location: `${label} > ${excerpt.label}`, value: excerpt.value });
    }
  }
  const { seo } = doc.meta;
  if (seo.title.trim()) out.push({ location: "SEO設定 > ページタイトル", value: seo.title });
  if (seo.metaDescription.trim()) out.push({ location: "SEO設定 > メタディスクリプション", value: seo.metaDescription });
  return out;
}

export async function checkGuidelineCompliance(doc: SiteDocument): Promise<GuidelineCheckResult> {
  const excerpts = collectExcerpts(doc);
  if (excerpts.length === 0) {
    return { ok: true, summary: "確認できる掲載文がまだありません。", issues: [] };
  }

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(excerpts) },
    ],
    text: { format: zodTextFormat(resultSchema, "guideline_check") },
  });

  const parsed = response.output_parsed as z.infer<typeof resultSchema> | null;
  if (!parsed) {
    throw new Error("ガイドライン確認に失敗しました。");
  }
  return parsed;
}
