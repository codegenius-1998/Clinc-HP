import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { DesignPreset, ColorTheme } from "@/lib/designPresets";
import type { SiteSpec, SiteSpecSection } from "@/lib/siteSpec";

export type ImageRole = "logo" | "photo" | "icon";
export type ImageAspect = "1:1" | "4:3" | "16:9" | "2:1";

export type PlannedImage = {
  sectionId: string;
  blockIndex?: number;
  role: ImageRole;
  prompt: string;
  alt: string;
  aspect: ImageAspect;
};

export type ContentBlock = { heading: string; body: string };

export type SectionContent = { heading: string; body: string; blocks: ContentBlock[] };

export type ContentPlan = {
  seo: { title: string; metaDescription: string; ogTitle: string; ogDescription: string; ogSiteName: string };
  hero: { headline: string; subheadline: string };
  sections: Record<string, SectionContent>;
  images: PlannedImage[];
  newsFallback: { date: string; title: string }[];
  faqFallback: { question: string; answer: string }[];
};

const IMAGE_ASPECTS = ["1:1", "4:3", "16:9", "2:1"] as const;

const imageSchema = z.object({
  sectionId: z.string(),
  blockIndex: z.number().nullable(),
  role: z.enum(["logo", "photo", "icon"]),
  prompt: z.string(),
  alt: z.string(),
  aspect: z.enum(IMAGE_ASPECTS),
});

const sectionContentSchema = z.object({
  heading: z.string(),
  body: z.string(),
  blocks: z.array(z.object({ heading: z.string(), body: z.string() })),
});

function buildSystemPrompt(siteSpec: SiteSpec, preset: DesignPreset): string {
  return `あなたは個人クリニックのホームページを一から作成するAIディレクター件コピーライターです。
渡された資料をもとに、このクリニックサイトのページ内容プラン（JSON）を1回で作成してください。**HTMLタグは一切出力しません**。出力はテキスト内容と画像の生成指示（プロンプト）だけです。ページの組み立て（HTML/CSS）はこの後コード側が行います。

# 絶対に守るルール（正直性）
${siteSpec.honestyRules.map((r) => `- ${r}`).join("\n")}
- 上記に反する内容（存在しない電話番号・住所・診療時間・料金・資格・実績などの具体的事実の創作）を書いた場合、サイトの信頼性を損なうため固く禁止する。

# デザインプリセットの雰囲気
このサイトは「${preset.label}」というデザインプリセットで作成する。文章のトーンは次の指示に従うこと: ${preset.mood}

# 画像について
${siteSpec.imageStyleRules.map((r) => `- ${r}`).join("\n")}
- ロゴ（role: "logo"）: ${siteSpec.branding.logo.rule} 背景は${siteSpec.branding.logo.background}。
- promptは画像生成AIにそのまま渡す英語のプロンプトにすること。

# 出力形式
JSON。渡された「本文セクション一覧」に含まれるセクションIDごとに heading/body/blocks を作成すること（blocksは診療科カードや特徴カードなど、そのセクションで列挙形式が必要な場合のみ使う。不要なら空配列でよい）。画像は必要な枚数ぶん images 配列に列挙し、それぞれ sectionId（どのセクション用か）と blockIndex（該当セクションのblocksのうち何番目のカード用か。セクション全体用の画像ならnull）を指定すること。`;
}

function buildUserPrompt(
  hearing: HearingSheet,
  aiSections: SiteSpecSection[],
  needsNewsFallback: boolean,
  needsFaqFallback: boolean,
  colorTheme: ColorTheme
): string {
  const infoLines = [
    `クリニック名: ${hearing.clinicName}`,
    hearing.directorName && `院長名: ${hearing.directorName}`,
    hearing.address && `住所: ${hearing.address}`,
    hearing.department && `診療科: ${hearing.department}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    hearing.request && `ご要望: ${hearing.request}`,
    `選択した配色: ${colorTheme.label}`,
  ].filter((line): line is string => Boolean(line));

  const sectionLines = aiSections.map((s) => {
    const c = s.content;
    const guide = [c?.tone, c?.drivenBy ? `参考項目: ${c.drivenBy.join("/")}` : null].filter(Boolean).join(" / ");
    const imageGuide = s.images ? ` / 画像目安: ${s.images.count ?? ""}枚・${s.images.role ?? "photo"}・アスペクト比${s.images.aspect ?? "自由"}` : " / 画像不要";
    return `- id: ${s.id} / ラベル: ${s.label} / 内容の方針: ${guide}${imageGuide}`;
  });

  const fallbackLines = [
    needsNewsFallback ? "お知らせ: 実データが無いため、newsFallback に一般的なお知らせを2〜6件生成すること。" : null,
    needsFaqFallback ? "よくある質問: 実データが無いため、faqFallback に一般的なQ&Aを2〜6件生成すること。" : null,
  ].filter((l): l is string => Boolean(l));

  return [
    `# ヒアリングシート`,
    ...infoLines,
    ``,
    `# 本文セクション一覧（この内容でheading/body/blocksを作成すること）`,
    ...sectionLines,
    ``,
    `# 繰り返し項目の補完`,
    ...(fallbackLines.length > 0 ? fallbackLines : ["(補完不要。すべて実データがあるか非表示のため newsFallback / faqFallback は空配列でよい)"]),
    ``,
    `# 忘れずに`,
    `- ヘッダー用ロゴ画像（sectionId: "header", role: "logo", blockIndex: null）を必ず1件 images に含めること。`,
    `- TOPページ（ヒーロー）用の画像（sectionId: "hero", role: "photo", aspect: "2:1", blockIndex: null）を必ず1件 images に含めること。`,
    `- SEO（title / metaDescription / ogTitle / ogDescription / ogSiteName）を必ず作成すること。metaDescriptionは${"100〜130字程度"}。`,
  ].join("\n");
}

export async function generateContentPlan(
  hearing: HearingSheet,
  preset: DesignPreset,
  colorTheme: ColorTheme,
  siteSpec: SiteSpec,
  aiSections: SiteSpecSection[],
  needsNewsFallback: boolean,
  needsFaqFallback: boolean
): Promise<ContentPlan> {
  const schema = z.object({
    seo: z.object({
      title: z.string(),
      metaDescription: z.string(),
      ogTitle: z.string(),
      ogDescription: z.string(),
      ogSiteName: z.string(),
    }),
    hero: z.object({ headline: z.string(), subheadline: z.string() }),
    sections: z.object(Object.fromEntries(aiSections.map((s) => [s.id, sectionContentSchema]))),
    images: z.array(imageSchema),
    newsFallback: z.array(z.object({ date: z.string(), title: z.string() })),
    faqFallback: z.array(z.object({ question: z.string(), answer: z.string() })),
  });

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: buildSystemPrompt(siteSpec, preset) },
      { role: "user", content: buildUserPrompt(hearing, aiSections, needsNewsFallback, needsFaqFallback, colorTheme) },
    ],
    text: { format: zodTextFormat(schema, "content_plan") },
  });

  const parsed = response.output_parsed as z.infer<typeof schema> | null;
  if (!parsed) {
    throw new Error("ページ内容プランの生成に失敗しました。");
  }

  return {
    ...parsed,
    images: parsed.images.map((img) => ({ ...img, blockIndex: img.blockIndex ?? undefined })),
  };
}
