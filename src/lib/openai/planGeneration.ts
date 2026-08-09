import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { TemplateSection } from "@/lib/templates";
import type { ImageTarget } from "@/lib/htmlContent";

export type ImageStyle = "logo" | "icon" | "photo";

export type ImageGenerationPlan = {
  style: ImageStyle;
  prompt: string;
};

export type GenerationPlan = {
  /** section id -> show it or not. Only covers removable sections; others always stay visible. */
  sectionVisibility: Record<string, boolean>;
  /** image target id -> how to generate it and with what prompt. */
  imagePlans: Record<string, ImageGenerationPlan>;
};

const SYSTEM_PROMPT = `あなたはクリニックサイト制作のディレクター件AI画像プロンプトエンジニアです。
渡される資料をすべて踏まえ、次の2つを決定してください。

# 資料
- 「AI_GUIDE.md」: このテンプレートの人間向け編集ガイド。各画像・各セクションの本来の役割が書かれている。
- 「_removed_images_manifest.md」: このテンプレートから削除されたサンプル画像の一覧（元のファイル名・サイズ・用途・参照箇所）。
- 「ヒアリングシート」: 今回作成するクリニックの実データ。
- 「セクション一覧」: このテンプレートが持つセクション（表示/非表示を切り替え可能なもの）。
- 「画像枠一覧」: 実際にページ上に配置されている画像（alt属性・class・タグ名つき）。

# 1. セクションの表示/非表示（sectionVisibility）
「セクション一覧」のうち非表示にできるものについて、表示するかどうかを判定すること。
- 基本方針は「表示のまま」。ヒアリングシートの情報だけでは全く埋められず、一般的な文章で埋めることも不自然（実在しない固有の実績・資格などが無いと成立しない等）なセクションのみ非表示にすること。
- 迷った場合は表示のままにすること。

# 2. 画像の生成プラン（imagePlans）
渡された「画像枠一覧」の画像1件ごとに、AI_GUIDE.mdとマニフェストからその画像の本来の役割を読み取り、次を決めること。
- style: "logo"（サイトロゴ・ブランドマーク）/ "icon"（小さな装飾アイコン・バナー等の非写実的な画像）/ "photo"（実写風の写真）
- prompt: 実際に画像生成AIに渡す英語のプロンプト。役割・ヒアリングシートの情報（医院名・特徴など）を反映すること。
  - style が "logo" の場合: 実写ではなく、フラットなベクター調のロゴマーク。読める文字・単語を含めないこと（画像生成AIは正確な文字を描画できないため）。医療・クリニックを連想させるシンプルな図形（十字・葉・円などのミニマルなモチーフ）を使うこと。
  - style が "icon" の場合: 同様にフラットなベクター調のシンプルな装飾画像。写実的にしないこと。
  - style が "photo" の場合: 明るく清潔感のある医療機関らしい実写風の写真。人物の顔がはっきり写る描写は避け、文字・ウォーターマークを含めないこと。

出力は "sectionVisibility" と "imagePlans" のみのオブジェクト。`;

function buildUserPrompt(
  hearing: HearingSheet,
  removableSections: TemplateSection[],
  imageTargets: ImageTarget[],
  guide: string,
  imageManifest: string
): string {
  const infoLines = [
    `クリニック名: ${hearing.clinicName}`,
    hearing.directorName && `院長名: ${hearing.directorName}`,
    hearing.address && `住所: ${hearing.address}`,
    hearing.department && `診療科: ${hearing.department}`,
    hearing.hours && `診療時間: ${hearing.hours}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    hearing.request && `ご要望: ${hearing.request}`,
  ].filter((line): line is string => Boolean(line));

  const sectionLines = removableSections.map((s) => `- id: ${s.id} / ラベル: ${s.label}`);
  const imageLines = imageTargets.map(
    (t) => `- id: ${t.id} / パス: ${t.path} / alt: 「${t.alt || "(なし)"}」 / class: ${t.className || "(なし)"}`
  );

  return [
    `# AI_GUIDE.md`,
    guide || "(なし)",
    ``,
    `# _removed_images_manifest.md`,
    imageManifest || "(なし)",
    ``,
    `# ヒアリングシート`,
    ...infoLines,
    ``,
    `# セクション一覧（非表示にできるもののみ）`,
    ...(sectionLines.length > 0 ? sectionLines : ["(なし)"]),
    ``,
    `# 画像枠一覧`,
    ...(imageLines.length > 0 ? imageLines : ["(なし)"]),
  ].join("\n");
}

export async function planGeneration(
  hearing: HearingSheet,
  sections: TemplateSection[],
  imageTargets: ImageTarget[],
  guide: string,
  imageManifest: string
): Promise<GenerationPlan> {
  const removableSections = sections.filter((s) => s.removable);

  if (removableSections.length === 0 && imageTargets.length === 0) {
    return { sectionVisibility: {}, imagePlans: {} };
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  if (removableSections.length > 0) {
    shape.sectionVisibility = z.object(Object.fromEntries(removableSections.map((s) => [s.id, z.boolean()])));
  }
  if (imageTargets.length > 0) {
    shape.imagePlans = z.object(
      Object.fromEntries(
        imageTargets.map((t) => [
          t.id,
          z.object({ style: z.enum(["logo", "icon", "photo"]), prompt: z.string() }),
        ])
      )
    );
  }
  const schema = z.object(shape);

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(hearing, removableSections, imageTargets, guide, imageManifest) },
    ],
    text: { format: zodTextFormat(schema, "generation_plan") },
  });

  const parsed = response.output_parsed as
    | { sectionVisibility?: Record<string, boolean>; imagePlans?: Record<string, ImageGenerationPlan> }
    | null;
  if (!parsed) {
    throw new Error("生成プランの作成に失敗しました。");
  }

  return {
    sectionVisibility: parsed.sectionVisibility ?? {},
    imagePlans: parsed.imagePlans ?? {},
  };
}
