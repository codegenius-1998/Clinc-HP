import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { TemplateContentSlot } from "@/lib/templates";

const SYSTEM_PROMPT = `あなたはクリニック・医療機関のWebサイト制作を数多く手がけてきたコピーライターです。
渡される「ヒアリングシート」の内容と、「テキスト差し替え箇所」の一覧をもとに、各箇所に入れる短いテキストを1つずつ作成してください。

- 出力は渡された箇所のid をキーとするオブジェクトで、値はその箇所に入れる文字列そのもの（前後の説明・記号・引用符は不要）。
- 「ヒアリングシート」に記載の無い事実（住所・電話番号・実績・資格・年数など）を創作してはならない。記載が無い場合は、一般的なクリニックとして自然な範囲の言い回しにとどめること。
- 「医院の特徴」「ご要望」があれば、その内容・トーンを最優先で反映すること。
- 各箇所のラベル・CSSセレクタから、その箇所の役割（ページタイトル、メイン見出しなど）を推測し、役割にふさわしい長さ・トーンにすること（例: ページタイトルは20〜40文字程度、見出しは短く印象的に）。`;

function buildUserPrompt(hearing: HearingSheet, slots: TemplateContentSlot[]): string {
  const infoLines = [
    `クリニック名: ${hearing.clinicName}`,
    hearing.directorName && `院長名: ${hearing.directorName}`,
    hearing.address && `住所: ${hearing.address}`,
    hearing.hours && `診療時間: ${hearing.hours}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    hearing.request && `ご要望: ${hearing.request}`,
  ].filter((line): line is string => Boolean(line));

  const slotLines = slots.map((slot) => `- id: ${slot.id} / ラベル: ${slot.label} / セレクタ: ${slot.selector}`);

  return [
    `# ヒアリングシート`,
    ...infoLines,
    ``,
    `# テキスト差し替え箇所`,
    ...slotLines,
  ].join("\n");
}

export async function generateSiteCopy(
  hearing: HearingSheet,
  slots: TemplateContentSlot[]
): Promise<Record<string, string>> {
  if (slots.length === 0) {
    return {};
  }

  const shape = Object.fromEntries(slots.map((slot) => [slot.id, z.string()]));
  const schema = z.object(shape);

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(hearing, slots) },
    ],
    text: { format: zodTextFormat(schema, "site_copy") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("テキストの生成に失敗しました。");
  }

  return parsed as Record<string, string>;
}
