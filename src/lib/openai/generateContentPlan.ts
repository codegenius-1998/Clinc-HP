import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { Block, SiteDocument } from "@/lib/site/document";
import { BLOCK_DEFINITIONS } from "@/lib/site/blocks";
import { HONESTY_RULES, IMAGE_STYLE_RULES, LOGO_RULE, SEO_DESCRIPTION_LENGTH } from "@/lib/site/authoringRules";
import { CARD_COUNT_RANGE, variantsFor, type PlannedSection } from "@/lib/site/composition";

/** Writes the copy for one clinic against a chosen template's actual block list.
 *
 * The brief the model works from is the template itself: each authorable block's type, nav label and
 * sample heading. That is what lets an admin add a fifth content section to a template — or reorder
 * everything — and get sensible copy for it without a code change, since nothing here enumerates
 * "department / greeting / features / facility" the way the old SITE_SPEC-driven planner did.
 *
 * Blocks whose content is a matter of fact rather than of writing (診療時間・アクセス・料金・スタッフ)
 * are deliberately NOT shown to the model at all — see HONESTY_RULES. They are filled straight from
 * the hearing sheet in siteGenerator.ts. お知らせ・よくある質問 are the sole exception, and only when
 * the clinic supplied none. */

export type ImageRole = "logo" | "photo" | "icon";
export type ImageAspect = "1:1" | "4:3" | "16:9" | "2:1";

export type PlannedImage = {
  blockId: string;
  /** Index into the block's repeating slot (a rich block's cards, a gallery's photos). null = the
   * block's own single image. */
  cardIndex?: number;
  role: ImageRole;
  prompt: string;
  alt: string;
  aspect: ImageAspect;
};

export type BlockContent = {
  blockId: string;
  heading: string;
  body: string;
  cards: { heading: string; body: string }[];
};

export type ContentPlan = {
  seo: { title: string; metaDescription: string; ogTitle: string; ogDescription: string; ogSiteName: string };
  /** Layout choices, one entry per section that has any. Validated and clamped by
   * normalizeComposition before anything is applied — see src/lib/site/composition.ts. */
  composition: PlannedSection[];
  blocks: BlockContent[];
  newsFallback: { date: string; title: string }[];
  faqFallback: { question: string; answer: string }[];
  images: PlannedImage[];
};

const IMAGE_ASPECTS = ["1:1", "4:3", "16:9", "2:1"] as const;

const imageSchema = z.object({
  blockId: z.string(),
  cardIndex: z.number().nullable(),
  role: z.enum(["logo", "photo", "icon"]),
  prompt: z.string(),
  alt: z.string(),
  aspect: z.enum(IMAGE_ASPECTS),
});

const blockContentSchema = z.object({
  blockId: z.string(),
  heading: z.string(),
  body: z.string(),
  cards: z.array(z.object({ heading: z.string(), body: z.string() })),
});

const sectionPlanSchema = z.object({
  blockId: z.string(),
  /** Free string rather than an enum because the allowed values differ per block TYPE, which a single
   * structured-output schema cannot express. The prompt lists them per block and composition.ts
   * rejects anything else, so an invalid answer costs the template's own layout, not a broken page. */
  variant: z.string().nullable(),
  cardCount: z.number().nullable(),
});

const planSchema = z.object({
  composition: z.array(sectionPlanSchema),
  seo: z.object({
    title: z.string(),
    metaDescription: z.string(),
    ogTitle: z.string(),
    ogDescription: z.string(),
    ogSiteName: z.string(),
  }),
  blocks: z.array(blockContentSchema),
  newsFallback: z.array(z.object({ date: z.string(), title: z.string() })),
  faqFallback: z.array(z.object({ question: z.string(), answer: z.string() })),
  images: z.array(imageSchema),
});

/** Block types whose text is written rather than reported. Everything else is filled from the
 * hearing sheet and never reaches the model. */
const AUTHORABLE_TYPES = new Set<Block["type"]>(["hero", "rich", "freeText", "contact", "gallery", "imageBanner"]);

export function authorableBlocks(doc: SiteDocument): Block[] {
  return doc.blocks.filter((b) => b.visible && AUTHORABLE_TYPES.has(b.type));
}

/** How many repeating items the template's sample content shows — passed to the model as a target so
 * a template designed around a 3-up card grid doesn't come back with seven cards. */
function sampleCardCount(block: Block): number | null {
  if (block.type === "rich") return block.data.cards.length || null;
  if (block.type === "gallery") return block.data.images.length || null;
  return null;
}

function buildSystemPrompt(doc: SiteDocument): string {
  return `あなたは個人クリニックのホームページを一から作成するAIディレクター兼コピーライターです。
渡された資料をもとに、このクリニックサイトの文章プラン（JSON）を1回で作成してください。**HTMLタグは一切出力しません**。出力はテキスト内容と画像の生成指示（プロンプト）だけです。ページの組み立て（HTML/CSS）はこの後コード側が行います。改行を入れたい場合でも \`<br>\` のようなタグは絶対に書かず、タグを含まないプレーンテキストのみを書くこと。

# 絶対に守るルール（正直性）
${HONESTY_RULES.map((r) => `- ${r}`).join("\n")}
- 上記に反する内容（存在しない電話番号・住所・診療時間・料金・資格・実績などの具体的事実の創作）を書いた場合、サイトの信頼性を損なうため固く禁止する。

# このサイトのデザインの雰囲気
${doc.mood ?? "清潔感があり、初めての患者にも安心感を与えるトーン。"}
文章のトーンはこの雰囲気に合わせること。

# 画像について
${IMAGE_STYLE_RULES.map((r) => `- ${r}`).join("\n")}
- ロゴ（role: "logo"）: ${LOGO_RULE}
- promptは画像生成AIにそのまま渡す英語のプロンプトにすること。

# レイアウトの選択（composition）
「ブロック一覧」の各ブロックには、選べるレイアウトが示してある。医院の性格に合わせて1つ選び、composition 配列に書くこと。
- full-bleed: 画像を全面に敷き、その上に文字を重ねる。写真の力で見せたい医院向け。
- split: 画像と文字を左右に分ける。落ち着いた、読ませたい医院向け。
- centered: 画像の下に文字を置く。情報量が多い医院向け。
- grid: 写真つきのカードを格子状に並べる。項目が4つ前後で、視覚的に見せたいとき。
- list: 写真を左、文章を右に置いた行を縦に積む。1項目ずつ説明が長いとき。
- minimal: **写真を使わず**、番号と見出しと本文だけで並べる。項目名だけで伝わるとき、落ち着いた印象にしたいとき。
- overlap: カードを少しずつずらして重ねる。雑誌的で、動きのある印象にしたいとき。

**隣り合うセクションで同じレイアウトを選ばないこと。** 同じものが続くと1つの長いセクションに見えてしまう。
写真より文章で伝わる医院（心療内科、内科など）では minimal を積極的に使ってよい。
迷う場合は variant を null にすれば、テンプレート既定のレイアウトになる。
cardCount には、そのセクションに並べるカードの枚数を ${CARD_COUNT_RANGE.min}〜${CARD_COUNT_RANGE.max} で指定する（null なら目安どおり）。**cards 配列の要素数は必ず cardCount と一致させること。**

# 出力形式
JSON。「ブロック一覧」に挙がっている blockId ごとに blocks 配列の要素を1つずつ作ること（blockIdは必ず一覧のものをそのまま使う。勝手に増やさない）。
- 種類が「メインビジュアル」のブロックは、heading にキャッチコピー、body にサブコピーを書く（cards は空配列）。
- 種類が「文章＋カード」のブロックは、heading に見出し、body にリード文、cards に列挙するカードを書く。
- 種類が「お問い合わせ」のブロックは、heading に見出し、body に予約を促す短いリード文を書く（cards は空配列）。
- 種類が「写真ギャラリー」「画像バナー」のブロックは heading（バナーは重ねる短い文）だけ書き、body と cards は空でよい。
画像は必要な枚数ぶん images 配列に列挙し、blockId（どのブロック用か）と cardIndex（そのブロックのカード／写真の何番目用か。ブロック全体用の画像なら null）を指定すること。`;
}

function buildUserPrompt(hearing: HearingSheet, doc: SiteDocument, needsNews: boolean, needsFaq: boolean): string {
  const infoLines = [
    `クリニック名: ${hearing.clinicName}`,
    hearing.address && `住所: ${hearing.address}`,
    hearing.department && `診療科: ${hearing.department}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    (hearing.targetNames?.length ?? 0) > 0 && `想定する患者層: ${hearing.targetNames!.join("、")}`,
    hearing.request && `ご要望: ${hearing.request}`,
  ].filter((line): line is string => Boolean(line));

  const blockLines = authorableBlocks(doc).map((block) => {
    const def = BLOCK_DEFINITIONS[block.type];
    const cards = sampleCardCount(block);
    const variants = variantsFor(block.type);
    const parts = [
      `blockId: ${block.id}`,
      `種類: ${def.label}`,
      block.navLabel && `このセクションの役割: ${block.navLabel}`,
      cards && `カード枚数の目安: ${cards}枚`,
      variants.length > 0 && `選べるレイアウト: ${variants.join(" / ")}`,
    ].filter(Boolean);
    return `- ${parts.join(" / ")}`;
  });

  const fallbackLines = [
    needsNews ? "お知らせ: 実データが無いため、newsFallback に一般的なお知らせを2〜6件生成すること。" : null,
    needsFaq ? "よくある質問: 実データが無いため、faqFallback に一般的なQ&Aを2〜6件生成すること。" : null,
  ].filter((l): l is string => Boolean(l));

  return [
    `# ヒアリングシート`,
    ...infoLines,
    ``,
    `# ブロック一覧（この blockId それぞれについて文章を作成すること）`,
    ...blockLines,
    ``,
    `# 繰り返し項目の補完`,
    ...(fallbackLines.length > 0
      ? fallbackLines
      : ["(補完不要。実データがあるか非表示のため newsFallback / faqFallback は空配列でよい)"]),
    ``,
    `# 忘れずに`,
    `- ヘッダー用ロゴ画像（blockId: "logo", role: "logo", cardIndex: null, aspect: "1:1"）を必ず1件 images に含めること。`,
    `- SEO（title / metaDescription / ogTitle / ogDescription / ogSiteName）を必ず作成すること。metaDescriptionは${SEO_DESCRIPTION_LENGTH}。`,
    `- composition に、「選べるレイアウト」がある blockId すべてについて1件ずつ書くこと。`,
  ].join("\n");
}

export async function generateContentPlan(
  hearing: HearingSheet,
  doc: SiteDocument,
  needsNewsFallback: boolean,
  needsFaqFallback: boolean
): Promise<ContentPlan> {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: buildSystemPrompt(doc) },
      { role: "user", content: buildUserPrompt(hearing, doc, needsNewsFallback, needsFaqFallback) },
    ],
    text: { format: zodTextFormat(planSchema, "content_plan") },
  });

  const parsed = response.output_parsed as z.infer<typeof planSchema> | null;
  if (!parsed) {
    throw new Error("ページ内容プランの生成に失敗しました。");
  }

  const clean = stripStrayTags(parsed);
  return {
    ...clean,
    images: clean.images.map((img) => ({ ...img, cardIndex: img.cardIndex ?? undefined })),
  };
}

/** Every string field in the plan is inserted as plain React text (auto-escaped, so this is not an
 * XSS concern) — but the model occasionally hallucinates a stray HTML tag anyway (seen in practice:
 * a literal "<br>" inside a hero headline meant as a line-break hint), which then shows up as ugly
 * literal text on the page instead of being interpreted as markup. Strip anything that looks like an
 * HTML tag from every string in the parsed plan as a blanket safety net, rather than trying to
 * enumerate every field it could show up in. */
function stripStrayTags<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/gi, "") as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => stripStrayTags(v)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripStrayTags(v)])) as T;
  }
  return value;
}
