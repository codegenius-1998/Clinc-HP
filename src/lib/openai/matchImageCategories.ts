import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import { IMAGE_CATEGORIES, type ImageCategoryKey } from "@/lib/imageCategories";

/** A single planned image placement (photo/icon role only — logos are always AI-generated and never
 * routed through this matcher) that needs either a real uploaded photo or an AI-generated one. */
export type ImageTarget = { id: string; alt: string };

export type CategorySample = { key: ImageCategoryKey; sampleUrl: string };

const SYSTEM_PROMPT = `あなたはクリニックサイトの写真配置を担当するディレクターです。
ページに配置される予定の画像枠（idごとに、その画像の役割を表すalt文）の一覧と、ユーザーが実際にアップロードした写真のカテゴリ（カテゴリごとのサンプル写真つき）が渡されます。
各画像枠に対して、渡されたカテゴリの中から最も適切なものを1つ選んでください。

- サンプル写真の実際の見た目（外観・内観・機器・人物・施術風景など）を確認し、画像枠のalt文から推測される役割と照らし合わせて判断すること。
- アップロードされた写真は加工・変更（トリミング等）せずそのまま掲載する対象である。写真の内容がその画像枠にふさわしいと判断した場合は、迷わずそのカテゴリを選ぶこと（AI生成に回すのは、ふさわしい写真が無い場合のみでよい）。
- 内容的にふさわしい候補が無ければ、無理に当てはめず "none" を選んでAI生成に回してよい。
- 出力は画像枠のidをキー、選んだカテゴリキー（またはnone）を値とするオブジェクト。`;

function buildTargetListText(imageTargets: ImageTarget[]): string {
  const targetLines = imageTargets.map((t) => `- id: ${t.id} / 用途: 「${t.alt || "(なし)"}」`);
  return [`# 画像枠一覧`, ...targetLines].join("\n");
}

/** Decides which uploaded-photo category (if any) best fits each image placement on the page,
 * by showing the model one representative sample photo per category alongside the placement metadata. */
export async function matchImagesToCategories(
  imageTargets: ImageTarget[],
  categorySamples: CategorySample[]
): Promise<Record<string, ImageCategoryKey | null>> {
  if (imageTargets.length === 0 || categorySamples.length === 0) {
    return {};
  }

  const availableKeys = categorySamples.map((c) => c.key);
  const categoryEnum = [...availableKeys, "none"] as unknown as [string, ...string[]];
  const shape = Object.fromEntries(imageTargets.map((t) => [t.id, z.enum(categoryEnum)]));
  const schema = z.object(shape);

  const sampleContent = categorySamples.flatMap(({ key, sampleUrl }) => {
    const label = IMAGE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
    return [
      { type: "input_text" as const, text: `カテゴリ「${key}」（${label}）のサンプル写真:` },
      { type: "input_image" as const, image_url: sampleUrl, detail: "low" as const },
    ];
  });

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [{ type: "input_text", text: buildTargetListText(imageTargets) }, ...sampleContent],
      },
    ],
    text: { format: zodTextFormat(schema, "image_category_match") },
  });

  const parsed = response.output_parsed as Record<string, string> | null;
  if (!parsed) {
    throw new Error("画像カテゴリの判定に失敗しました。");
  }

  const result: Record<string, ImageCategoryKey | null> = {};
  for (const target of imageTargets) {
    const value = parsed[target.id];
    result[target.id] = value && value !== "none" ? (value as ImageCategoryKey) : null;
  }
  return result;
}
