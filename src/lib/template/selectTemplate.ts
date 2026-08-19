import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/openai/client";
import { getDocument, listTemplates } from "@/lib/site/store";
import { buildDefaultTemplate } from "@/lib/site/defaultTemplate";
import type { HearingSheet } from "@/lib/hearing";
import type { SiteDocument } from "@/lib/site/document";

/** Picks the design template for a clinic from its hearing sheet. The clinic never chooses — that is
 * the point of the flow — so this has to be right often enough to be trusted and must never be the
 * reason a generation fails. Every failure path therefore falls back rather than throwing:
 *
 *   no sellable templates -> the built-in default layout
 *   AI unavailable / returns nonsense -> the newest sellable template
 *
 * The model is shown only each template's name, mood and tags. That is deliberate: the mood text is
 * the thing an admin writes to describe atmosphere, so improving selection is an editing task rather
 * than a prompt-engineering one. */

const selectionSchema = z.object({
  templateId: z.string(),
  reason: z.string(),
});

function hearingBrief(hearing: HearingSheet): string {
  return [
    `クリニック名: ${hearing.clinicName}`,
    hearing.department && `診療科: ${hearing.department}`,
    (hearing.serviceNames?.length ?? 0) > 0 && `提供サービス: ${hearing.serviceNames!.join("、")}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    (hearing.featureNames?.length ?? 0) > 0 && `特徴タグ: ${hearing.featureNames!.join("、")}`,
    (hearing.targetNames?.length ?? 0) > 0 && `想定する患者層: ${hearing.targetNames!.join("、")}`,
    hearing.request && `ご要望: ${hearing.request}`,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");
}

export type TemplateSelection = {
  template: SiteDocument;
  /** Why this one — surfaced on the site detail screen so an admin can tell a bad pick from a bad
   * template, and null when no AI call was involved. */
  reason: string | null;
};

export async function selectTemplate(hearing: HearingSheet): Promise<TemplateSelection> {
  const candidates = await listTemplates({ sellableOnly: true });

  if (candidates.length === 0) {
    return { template: buildDefaultTemplate(), reason: null };
  }

  const fallback = async (): Promise<SiteDocument> =>
    (await getDocument(candidates[0].id)) ?? buildDefaultTemplate();

  if (candidates.length === 1) {
    return { template: await fallback(), reason: null };
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.parse({
      model: "gpt-5.6-terra",
      input: [
        {
          role: "system",
          content: `あなたはクリニックのホームページ制作ディレクターです。
ヒアリングシートの内容に最も合うデザインテンプレートを、候補の中から必ず1つ選んでください。
判断材料は各テンプレートの「雰囲気」と「タグ」です。診療科の対象年齢層（小児科なら明るく親しみやすい、審美・自由診療なら落ち着いた高級感、など）、患者層、医院の要望との相性を重視して選ぶこと。
templateId には必ず候補一覧にある id をそのまま返すこと。reason には選んだ理由を日本語1文で書くこと。`,
        },
        {
          role: "user",
          content: [
            "# ヒアリングシート",
            hearingBrief(hearing),
            "",
            "# テンプレート候補",
            ...candidates.map((t) =>
              [
                `- id: ${t.id}`,
                `  名前: ${t.name}`,
                `  雰囲気: ${t.mood ?? "（未設定）"}`,
                `  タグ: ${t.tags.length > 0 ? t.tags.join("、") : "（なし）"}`,
              ].join("\n")
            ),
          ].join("\n"),
        },
      ],
      text: { format: zodTextFormat(selectionSchema, "template_selection") },
    });

    const parsed = response.output_parsed as z.infer<typeof selectionSchema> | null;
    const chosen = parsed && candidates.find((t) => t.id === parsed.templateId);
    if (!chosen) {
      console.warn("[selectTemplate] AIが候補外のidを返したため、先頭のテンプレートを使います。", parsed?.templateId);
      return { template: await fallback(), reason: null };
    }

    const template = await getDocument(chosen.id);
    if (!template) {
      return { template: await fallback(), reason: null };
    }
    return { template, reason: parsed.reason };
  } catch (err) {
    // Template choice is a nicety; generation succeeding is not. Never let this path fail the run.
    console.warn("[selectTemplate] テンプレートの自動選択に失敗したため、先頭のテンプレートを使います。", err);
    return { template: await fallback(), reason: null };
  }
}
