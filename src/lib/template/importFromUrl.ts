import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/openai/client";
import { assertPublicUrl } from "./safeFetch";
import { describeSignals, extractDesignSignals, type DesignSignals } from "./extractDesignSignals";
import { DEFAULT_DESIGN_TOKENS, designTokensSchema, type DesignTokens, type SiteDocument } from "@/lib/site/document";
import { defaultTemplateBlocks } from "@/lib/site/defaultTemplate";
import { deleteDocument, newDocumentId, saveDocument } from "@/lib/site/store";
import { renderSiteFiles } from "@/lib/render/renderSiteFiles";
import { applySampleCopy } from "./sampleCopy";

/** Turns a reference site (and/or a few reference images) into a reusable design template.
 *
 * What is taken is the design DIRECTION — palette, typography, corner radius, shadow depth, motion —
 * never the reference site's content or its image files. Images are shown to the model as URLs for
 * analysis and are deliberately not downloaded or stored; the template's own sample photos are
 * placeholders the admin replaces in the editor.
 *
 * The model's numbers are treated as suggestions, not as truth: `normalizeDesignTokens` clamps every
 * value into the range the renderer can actually express and falls back per-field to
 * DEFAULT_DESIGN_TOKENS. That matters because OpenAI's structured outputs cannot enforce numeric
 * bounds or string patterns, so the schema below is deliberately loose and validation happens here. */

/** Loose mirror of DesignTokens: no min/max and no colour regex, because structured outputs reject
 * those keywords. Every value is re-checked in normalizeDesignTokens. */
const aiTemplateSchema = z.object({
  name: z.string(),
  mood: z.string(),
  tags: z.array(z.string()),
  colors: z.object({
    primary: z.string(),
    accent: z.string(),
    light: z.string(),
    background: z.string(),
    text: z.string(),
    primaryInverse: z.string(),
    accentInverse: z.string(),
  }),
  font: z.object({
    headingFamily: z.string(),
    bodyFamily: z.string(),
    googleFonts: z.array(z.string()),
    baseSize: z.number(),
    lineHeight: z.number(),
    headingWeight: z.number(),
  }),
  block: z.object({
    radius: z.number(),
    borderWidth: z.number(),
    borderColor: z.string(),
    shadow: z.enum(["none", "soft", "strong"]),
    cardLayout: z.enum(["grid", "list", "minimal", "overlap"]),
  }),
  layout: z.object({
    heroLayout: z.enum(["full-bleed", "split", "centered"]),
    maxWidth: z.number(),
    spacingScale: z.number(),
    sectionDivider: z.enum(["none", "wave", "diagonal"]),
    background: z.enum(["plain", "gradient", "blobs", "dots", "grid"]),
    decoration: z.enum(["none", "accent", "rich"]),
  }),
  animation: z.object({
    reveal: z.enum(["none", "fade", "slide-up", "slide-left", "slide-right", "zoom", "pop", "flip", "blur"]),
    duration: z.number(),
    stagger: z.boolean(),
    parallaxHero: z.boolean(),
    variety: z.boolean(),
  }),
});

type AiTemplate = z.infer<typeof aiTemplateSchema>;

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Checks a reference image is actually fetchable and actually an image before handing its URL to
 * the model. Worth the round trip: the model fetches these itself, and a single dead URL — a stale
 * <img src> on the reference page, a hotlink-protected CDN — fails the whole request with
 * "Error while downloading file", which tells the admin nothing about which image was at fault.
 *
 * Uses a 1-byte ranged GET rather than HEAD, since plenty of servers answer HEAD with 405. */
async function isFetchableImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0 (compatible; ClincHP-TemplateImporter/1.0)" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok && response.status !== 206) return false;
    await response.body?.cancel();
    return (response.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
}

function safeColor(value: string, fallback: string): string {
  const trimmed = value.trim().toLowerCase();
  return HEX.test(trimmed) ? trimmed : fallback;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function safeFamily(value: string, fallback: string): string {
  const trimmed = value.trim();
  // A font stack with no generic fallback renders as Times on any machine missing the first family.
  if (trimmed.length === 0) return fallback;
  return /(sans-serif|serif|monospace|cursive)\s*$/i.test(trimmed) ? trimmed : `${trimmed}, ${fallback}`;
}

export function normalizeDesignTokens(ai: AiTemplate): DesignTokens {
  const d = DEFAULT_DESIGN_TOKENS;
  return designTokensSchema.parse({
    colors: {
      primary: safeColor(ai.colors.primary, d.colors.primary),
      accent: safeColor(ai.colors.accent, d.colors.accent),
      light: safeColor(ai.colors.light, d.colors.light),
      background: safeColor(ai.colors.background, d.colors.background),
      text: safeColor(ai.colors.text, d.colors.text),
      primaryInverse: safeColor(ai.colors.primaryInverse, d.colors.primaryInverse),
      accentInverse: safeColor(ai.colors.accentInverse, d.colors.accentInverse),
    },
    font: {
      headingFamily: safeFamily(ai.font.headingFamily, d.font.headingFamily),
      bodyFamily: safeFamily(ai.font.bodyFamily, d.font.bodyFamily),
      googleFonts: ai.font.googleFonts.map((f) => f.trim()).filter((f) => f.length > 0 && f.length < 120).slice(0, 3),
      baseSize: Math.round(clamp(ai.font.baseSize, 12, 22, d.font.baseSize)),
      lineHeight: Number(clamp(ai.font.lineHeight, 1.2, 2.4, d.font.lineHeight).toFixed(2)),
      headingWeight: Math.round(clamp(ai.font.headingWeight, 300, 900, d.font.headingWeight) / 100) * 100,
    },
    block: {
      radius: Math.round(clamp(ai.block.radius, 0, 48, d.block.radius)),
      borderWidth: Math.round(clamp(ai.block.borderWidth, 0, 4, d.block.borderWidth)),
      borderColor: safeColor(ai.block.borderColor, d.block.borderColor),
      shadow: ai.block.shadow,
      cardLayout: ai.block.cardLayout,
    },
    layout: {
      heroLayout: ai.layout.heroLayout,
      maxWidth: Math.round(clamp(ai.layout.maxWidth, 880, 1440, d.layout.maxWidth)),
      spacingScale: Number(clamp(ai.layout.spacingScale, 0.7, 2, d.layout.spacingScale).toFixed(2)),
      sectionDivider: ai.layout.sectionDivider,
      background: ai.layout.background,
      decoration: ai.layout.decoration,
    },
    animation: {
      reveal: ai.animation.reveal,
      // A reveal with a near-zero duration is an incoherent pair: the element still starts at
      // opacity 0 and waits on the IntersectionObserver, but snaps in with no transition — which
      // reads as content flashing rather than as a design choice. If the model wants no motion it
      // should say so via reveal: "none", so anything else gets a duration you can actually see.
      duration:
        ai.animation.reveal === "none"
          ? 0
          : Math.round(clamp(ai.animation.duration, 200, 2000, d.animation.duration)),
      stagger: ai.animation.stagger,
      parallaxHero: ai.animation.parallaxHero,
      variety: ai.animation.variety,
    },
  });
}

const SYSTEM_PROMPT = `あなたはWebデザインを数値化するアシスタントです。
参考サイトのHTML/CSSから機械的に抽出した情報と、参考画像をもとに、そのサイトの「デザインの方向性」をテンプレート設定（JSON）として書き出してください。

# 何を取り出すか
- 取り出すのは配色・書体・角丸・影・余白・動きといったデザインの方向性だけです。
- 参考サイトの文章・ロゴ・写真そのものを再現してはいけません。文章は一切出力しません。

# 判断の優先順位
1. サイトが自分で定義しているCSS変数（--primary など）があれば最優先で使う。
2. 次に、出現回数の多い色。ただし本文の黒や背景の白をprimaryにしてはいけない。primaryはブランドを感じさせる有彩色を選ぶこと。
3. 画像が添付されている場合は、実際の見た目の印象（明るさ・高級感・親しみやすさ・余白の広さ）を最終判断に反映する。

# 各項目の決め方
- colors.light は primary をごく薄くした背景用の色（セクションの交互背景に使う）。白に近いが白ではない色にすること。
- colors.primaryInverse / accentInverse は primary / accent の上に乗せる文字色。コントラストが確保できる色（多くの場合 #ffffff）にすること。
- font.googleFonts は、参考サイトが実際にGoogle Fontsを読み込んでいた場合のみ、"Noto Sans JP:wght@400;700" の形式で書く。読み込んでいなければ空配列にする。日本語サイトなので、日本語グリフを持つフォント以外を本文に指定しないこと。
- font.headingFamily / bodyFamily は CSSにそのまま書ける font-family の値。末尾に必ず sans-serif か serif を付けること。
- block.cardLayout: 写真つきカードが並ぶなら "grid"、写真＋文章が横に並ぶ記事的な見た目なら "list"、写真をほとんど使わない硬派な見た目なら "minimal"、カードを少しずらして重ねる雑誌的な見た目なら "overlap"。
- layout.heroLayout: 大きな写真に文字を重ねるなら "full-bleed"、写真と文字が左右に分かれるなら "split"、写真の下に文字を置くなら "centered"。
- layout.background: 参考サイトの背景の作り。真っ白/単色なら "plain"、上下や斜めのグラデーションがあるなら "gradient"、ぼかした色の塊が置いてあるなら "blobs"、ドット柄なら "dots"、方眼・罫線柄なら "grid"。
- layout.decoration: 見出し記号・セクション番号・角の飾りなど装飾要素の量。素っ気なければ "none"、控えめにあれば "accent"、装飾が目立つサイトなら "rich"。
- animation.variety: セクションごとに登場の向きやカードの並びが変わっているように見えるなら true。全セクションが同じ入り方なら false。
- animation: @keyframes や transition が多いサイトほど動きのある設定にする。動きの気配が無ければ reveal を "fade" か "none" にすること。reveal は none / fade / slide-up / slide-left / slide-right / zoom / pop（弾む）/ flip（奥から起き上がる）/ blur（ぼけから像を結ぶ）から選ぶ。派手な動きの参考サイトには pop・flip・blur を積極的に使ってよい。
- name はテンプレート名（日本語・15文字以内・「〜系」「〜調」のように雰囲気が分かる短い名前）。
- mood は、このテンプレートがどんなクリニックに合うかを説明する日本語2〜3文。あとでAIがヒアリング内容と照らして自動選択する際の唯一の判断材料になるので、色やフォント名ではなく「誰に・どんな印象を与えるか」を書くこと。
- tags は 3〜6個の短い日本語タグ（例: 小児科向け, 明るい, 高級感, 和モダン）。`;

export type ImportTemplateInput = {
  /** Reference site. Optional when the admin is working purely from images. */
  url?: string;
  /** Extra reference images the admin pasted (a screenshot, a design comp). */
  imageUrls?: string[];
  /** Overrides the AI-suggested name when the admin already knows what to call it. */
  name?: string;
};

export type ImportTemplateResult = {
  document: SiteDocument;
  signals: DesignSignals | null;
  previewUrl: string;
  /** Surfaced in the UI: an SPA reference site yields almost no usable CSS, and the admin should know
   * the result leaned on the images (or on defaults) rather than on the site itself. */
  warnings: string[];
};

export async function importTemplateFromUrl(input: ImportTemplateInput): Promise<ImportTemplateResult> {
  const warnings: string[] = [];

  if (!input.url && (input.imageUrls?.length ?? 0) === 0) {
    throw new Error("参考サイトのURLか、参考画像のURLのどちらかは必要です。");
  }

  let signals: DesignSignals | null = null;
  if (input.url) {
    signals = await extractDesignSignals(input.url);
    if (signals.looksClientRendered) {
      warnings.push(
        "参考サイトはJavaScriptで描画されるタイプのため、HTMLとCSSからはほとんど情報を読み取れませんでした。参考画像を追加するか、作成後に編集画面で調整してください。"
      );
    }
    if (signals.colors.length === 0) {
      warnings.push("参考サイトから色を読み取れませんでした。既定の配色を元にしています。");
    }
  }

  // The site's own images are only used when the admin didn't supply better ones.
  const adminImages = input.imageUrls ?? [];
  const candidateImages = adminImages.length > 0 ? adminImages : (signals?.imageCandidates ?? []).slice(0, 3);
  const imageUrls: string[] = [];
  for (const raw of candidateImages.slice(0, 4)) {
    let href: string;
    try {
      href = (await assertPublicUrl(raw)).href;
    } catch {
      warnings.push(`参考画像を読み込めませんでした（${raw}）。`);
      continue;
    }
    if (await isFetchableImage(href)) {
      imageUrls.push(href);
    } else if (adminImages.length > 0) {
      // Only worth telling the admin about images they chose themselves; the ones scraped off the
      // reference page are a best-effort extra and a dead one is not their problem.
      warnings.push(`参考画像を取得できませんでした（${raw}）。`);
    }
  }

  const userContent: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" })[] = [
    {
      type: "input_text",
      text: signals
        ? `# 参考サイトから抽出した情報\n${describeSignals(signals)}`
        : "# 参考サイト\n指定なし。添付された参考画像だけを手がかりにテンプレート設定を決めてください。",
    },
  ];
  for (const url of imageUrls) {
    userContent.push({ type: "input_image", image_url: url, detail: "auto" });
  }

  const openai = getOpenAIClient();
  const ask = async (content: typeof userContent) =>
    openai.responses.parse({
      model: "gpt-5.6-terra",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      text: { format: zodTextFormat(aiTemplateSchema, "design_template") },
    });

  let response;
  try {
    response = await ask(userContent);
  } catch (err) {
    // A reference image can be unreadable for reasons no URL check can predict: hotlink protection
    // returning an HTML error page, a mislabelled content type, a redirect to a login screen. The
    // CSS evidence is usually enough on its own, so drop the images and try once more rather than
    // making the admin guess which URL was the bad one.
    // Any failure with images attached is retried without them. The failure mode is almost always
    // the images (unreachable, mislabelled, hotlink-protected) and the CSS evidence alone is usually
    // enough, so one extra call beats making the admin debug a URL list.
    if (imageUrls.length === 0) throw err;
    console.warn("[importFromUrl] 参考画像つきの解析に失敗したため、画像なしで再試行します。", err);
    warnings.push("参考画像を読み込めなかったため、HTMLとCSSの情報だけで判断しました。");
    response = await ask([userContent[0]]);
  }

  const parsed = response.output_parsed as AiTemplate | null;
  if (!parsed) {
    throw new Error("テンプレートの解析に失敗しました。時間をおいて再度お試しください。");
  }

  const now = new Date().toISOString();
  const id = newDocumentId();
  const name = (input.name ?? parsed.name).trim() || "新しいテンプレート";

  const document: SiteDocument = {
    id,
    slug: `template-${id.slice(0, 8)}`,
    name,
    isTemplate: true,
    // New templates are held back from the auto-selector until an admin has looked at them.
    canSell: false,
    design: normalizeDesignTokens(parsed),
    meta: {
      clinicName: "サンプルクリニック",
      phone: "00-0000-0000",
      line: "",
      address: "東京都〇〇区〇〇 1-2-3",
      logoImage: "images/placeholder.svg",
      seo: {
        title: `${name}｜テンプレートプレビュー`,
        metaDescription: parsed.mood.slice(0, 120),
        ogTitle: name,
        ogDescription: parsed.mood.slice(0, 120),
        ogSiteName: name,
      },
      snsLinks: [],
    },
    blocks: applySampleCopy(defaultTemplateBlocks()),
    mood: parsed.mood,
    tags: parsed.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8),
    sourceUrl: signals?.finalUrl ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Saving is two statements against D1 (the site row, then its blocks) with no transaction spanning
  // them, so a failure partway leaves a template with no blocks — which then shows up in the admin
  // list as a real, broken template. Roll the row back rather than leaving that behind.
  let saved;
  try {
    saved = await saveDocument(document);
  } catch (err) {
    await deleteDocument(document.id).catch(() => {});
    throw err;
  }

  const { previewUrl } = await renderSiteFiles(saved);
  return { document: saved, signals, previewUrl, warnings };
}
