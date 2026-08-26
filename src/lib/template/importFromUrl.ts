import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/openai/client";
import { assertPublicUrl } from "./safeFetch";
import { describeSignals, extractDesignSignals, type DesignSignals } from "./extractDesignSignals";
import {
  BLOCK_TYPES,
  DEFAULT_DESIGN_TOKENS,
  designTokensSchema,
  type DesignTokens,
  type SiteDocument,
} from "@/lib/site/document";
import { ARCHETYPES, ARCHETYPE_KEYS, archetypeBlocks, isArchetypeKey, type ArchetypeKey } from "@/lib/site/archetypes";
import { VARIANT_DESCRIPTIONS, variantsFor } from "@/lib/site/composition";
import { blockLabel } from "@/lib/site/blocks";
import { checkDesign } from "@/lib/site/designCheck";
import { ALLOWED_NAV_LABELS, resolveStructure } from "./blockPlan";
import { illustrateTemplate } from "./illustrateTemplate";
import { deleteDocument, newDocumentId, saveDocument, usedOrnaments } from "@/lib/site/store";
import { decorationFor, fillMissingDecoration } from "@/lib/site/decoration";
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
    displayScale: z.number(),
    headingLetterSpacing: z.number(),
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
    rule: z.enum(["none", "hairline", "accent-bar"]),
    ornament: z.enum(["none", "seigaiha", "asanoha", "dots-fine", "hairlines", "arc"]),
    ornamentStrength: z.number(),
    backdrop: z.enum(["none", "page", "sections"]),
  }),
  chrome: z.object({
    header: z.enum(["bar", "stacked", "minimal"]),
    footer: z.enum(["dark", "light", "compact", "band"]),
  }),
  /** The reference site's SKELETON. Loose everywhere it can be: `type` is a bare string rather than
   * an enum because structured outputs would then reject the whole response over one typo, and
   * `normalizeBlockPlan` drops what it does not recognise. */
  structure: z.object({
    archetype: z.enum([...ARCHETYPE_KEYS, "custom"]),
    pages: z.array(
      z.object({
        path: z.string(),
        navLabel: z.string(),
        blocks: z.array(
          z.object({
            type: z.string(),
            navLabel: z.string(),
            variant: z.string().nullable(),
            cardCount: z.number().nullable(),
          })
        ),
      })
    ),
  }),
  animation: z.object({
    reveal: z.enum(["none", "fade", "slide-up", "slide-left", "slide-right", "zoom", "pop", "flip", "blur"]),
    duration: z.number(),
    stagger: z.boolean(),
    parallaxHero: z.boolean(),
    variety: z.boolean(),
    ambient: z.enum(["none", "drift", "float", "sheen"]),
    progressBar: z.boolean(),
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
      displayScale: Number(clamp(ai.font.displayScale, 1, 2.2, d.font.displayScale).toFixed(2)),
      headingLetterSpacing: Number(
        clamp(ai.font.headingLetterSpacing, -0.02, 0.3, d.font.headingLetterSpacing).toFixed(3)
      ),
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
      rule: ai.layout.rule,
      ornament: ai.layout.ornament,
      ornamentStrength: Number(clamp(ai.layout.ornamentStrength, 0, 1, d.layout.ornamentStrength).toFixed(2)),
      backdrop: ai.layout.backdrop,
      // ⚠️ Never taken from the model. The path is filled by the image pipeline (BACKDROP_SLOT), and
      // a value here could only be a URL on the reference site — which is exactly the image copying
      // this importer refuses to do.
      backdropImage: "",
    },
    chrome: { header: ai.chrome.header, footer: ai.chrome.footer },
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
      // Ambient motion on a template that opted out of motion entirely is a contradiction the CSS
      // already refuses to honour (every ambient rule is prefixed `html:not([data-reveal="none"])`).
      // Resolving it here as well keeps the stored document from claiming something untrue.
      // ⚠️ Two ways to end up claiming motion that never happens, both seen in real output:
      // a template that opted out of motion entirely, and — the one actually shipped —
      // `ambient: "float"` with `ornament: "none"`, where the element the animation targets is
      // never emitted at all, so the page carries the attribute and moves nothing.
      ambient:
        ai.animation.reveal === "none" || ai.layout.ornament === "none" ? "none" : ai.animation.ambient,
      progressBar: ai.animation.progressBar,
    },
  });
}


/** The half of the prompt that describes the SKELETON, generated from the registries rather than
 * written out.
 *
 * ⚠️ Generated, not hand-written, for the same reason describeVariants is in generateContentPlan: a
 * hand-listed vocabulary drifts the moment a block type or a variant is added, and a value the model
 * was never told about is one it never returns — the feature then looks broken rather than unused. */
const STRUCTURE_PROMPT = `# ページ構成（structure）の決め方
参考サイトの「骨格」を写します。写すのはセクションの**種類・並び・枚数**だけで、文章や写真は写しません。

## 使えるセクションの種類
${BLOCK_TYPES.map((type) => {
  const variants = variantsFor(type).map((v) => `${v}（${VARIANT_DESCRIPTIONS[`${type}:${v}`] ?? v}）`);
  const cards = type === "rich" ? "。cardCount で項目数（2〜6）も指定できる" : "";
  return `- ${type}（${blockLabel(type)}）${variants.length > 0 ? `: variant = ${variants.join(" / ")}` : ": variant なし"}${cards}`;
}).join("\n")}
variant に迷ったら null にしてください。null はテンプレート既定の見た目という意味です。

## まず、手持ちの型に当てはまるかを見る
${ARCHETYPE_KEYS.map((key) => `- ${key}（${ARCHETYPES[key].label}）: ${ARCHETYPES[key].description}`).join("\n")}
- 近い型があれば structure.archetype にその名前を書き、structure.pages は空の配列にしてください。型は検証済みなので、そちらのほうが安全です。
- どれにも当てはまらないときだけ structure.archetype を "custom" にして、structure.pages を自分で書きます。

## structure.pages を書くときの決まり
- 1ページ目が必ずトップページです。path は空文字（""）にします。
- 2ページ目以降の path は英小文字・数字・ハイフンだけ（about, service, access など）。日本語は使えません。
- ページは最大6つ、1ページのセクションは最大12個、全体で最大24個。
- 参考サイトが1枚もの（ナビのリンクがすべて同じページ内）なら、ページを増やしてはいけません。
- セクションの並びは参考サイトの並びに合わせます。「同じ形の項目が◯個」と書かれていたら、その数をそのまま cardCount にします。
- お問い合わせ（contact）はサイト全体で1つだけ。最後のページの末尾に置くのが自然です。
- メインビジュアル（hero）はトップページの先頭に置きます。下層ページには無くて構いません。

## navLabel に使える言葉（これ以外は使えません）
${[...ALLOWED_NAV_LABELS].join(" / ")}
- 医院名・キャッチコピー・参考サイト独自の見出しは絶対に書かないでください。上のどれにも当てはまらない場合は空文字にしてください。

# 参考サイトの文章・写真を写さないこと
- 出力してよいのはセクションの種類・並び・枚数・レイアウト名だけです。
- 参考サイトの見出し文・本文・医院名・電話番号・写真は、どの項目にも書いてはいけません。`;

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
- tags は 3〜6個の短い日本語タグ（例: 小児科向け, 明るい, 高級感, 和モダン）。
- font.displayScale: 見出しだけを何倍に大きくするか（1〜2.2）。写真が少なく文字で見せるサイトほど大きくする。ふつうのサイトは1〜1.2。
- font.headingLetterSpacing: 見出しの字間（em単位、-0.02〜0.3）。和文の見出しがゆったり組まれていれば0.05〜0.15、詰まっていれば0。
- layout.rule: セクション見出しの区切り方。太い下線でよければ "none"、細い罫線なら "hairline"、見出しの脇に色の棒があるなら "accent-bar"。
- chrome.header: ロゴと横並びのメニューなら "bar"、ロゴが中央にありその下にメニューが並ぶなら "stacked"、ロゴだけでメニューがほとんど無いなら "minimal"。
- chrome.footer: 濃い色地なら "dark"、明るい地なら "light"、情報が少なく小さいなら "compact"、ブランド色の帯なら "band"。
- layout.ornament: セクションの地紋（模様）。無地なら "none"、和風の波柄なら "seigaiha"、和風の幾何格子なら "asanoha"、細かい点なら "dots-fine"、斜めの細い線なら "hairlines"、大きな円弧の意匠なら "arc"。⚠️ 参考サイトに柄が見当たらないのに付けてはいけない。迷ったら "none"。
- layout.ornamentStrength: 地紋の濃さ（0〜1）。クリニックのページでは 0.1〜0.25 が自然。柄がはっきり見えるサイトでも 0.4 を超えないこと。
- layout.backdrop: ページ全体に大きな背景写真が敷かれているなら "page"、一部のセクションだけなら "sections"、無ければ "none"。⚠️ 写真そのものは取り込まず、こちらで新しく生成する。
- animation.ambient: 何も操作していなくても背景がずっと動いているなら、その動き方。ゆっくり流れるなら "drift"、ふわふわ上下するなら "float"、光が横切るなら "sheen"、動いていなければ "none"。⚠️ 参考サイトが静かなら必ず "none"。
- animation.progressBar: 画面の最上部にスクロール量を示す細い線があるなら true。

${STRUCTURE_PROMPT}`;

/** How many pictures a newly imported template gets for free. Small on purpose: enough that the
 * preview stops looking broken, few enough that browsing reference sites is not expensive. */
const INITIAL_IMAGE_COUNT = 5;

export type ImportTemplateInput = {
  /** Reference site. Optional when the admin is working purely from images. */
  url?: string;
  /** Extra reference images the admin pasted (a screenshot, a design comp). */
  imageUrls?: string[];
  /** Overrides the AI-suggested name when the admin already knows what to call it. */
  name?: string;
  /** Which block layout to build on. Left unset (the admin picked 「おまかせ」), the model reads the
   * reference site's own skeleton — its nav, its section order, its card counts — and either names
   * one of the archetypes or returns a page plan of its own. Set, it overrides that entirely. */
  archetype?: ArchetypeKey;
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

  // ⚠️ Decoration is assigned, not copied. See site/decoration.ts: reading a real clinic site
  // faithfully yields "no pattern, no motion, nav bar, dark footer" — which is the default set, so
  // every faithful import came out looking like every other one. Only the axes the model left at
  // their default are filled; an observation that the reference DOES have a pattern is kept.
  const design = normalizeDesignTokens(parsed);
  fillMissingDecoration(
    design,
    decorationFor(id, await usedOrnaments().catch(() => new Set<string>()), { hasPhone: true })
  );
  // An explicit choice in the admin form wins. Left unset, the model's reading of the reference
  // site's own skeleton decides — which is the whole point of reading the structure at all.
  const chosen = input.archetype && isArchetypeKey(input.archetype) ? input.archetype : null;
  const layout = chosen
    ? archetypeBlocks(chosen)
    : resolveStructure(parsed.structure.archetype, parsed.structure.pages);

  const document: SiteDocument = {
    id,
    slug: `template-${id.slice(0, 8)}`,
    name,
    isTemplate: true,
    // New templates are held back from the auto-selector until an admin has looked at them.
    canSell: false,
    design,
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
    pages: layout.pages,
    blocks: applySampleCopy(layout.blocks),
    mood: parsed.mood,
    tags: parsed.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8),
    sourceUrl: signals?.finalUrl ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Final gate on the SKELETON. checkDesign is the checker the rest of the app already trusts, so
  // the importer reuses it rather than re-deriving "is this shaped like a clinic site" — and it runs
  // after applySampleCopy, because an unwritten hero headline is itself a high-severity finding.
  //
  // ⚠️ Only `structure-*` findings count. A high-severity CONTRAST finding is about the palette the
  // model chose, and throwing away a faithful page plan because the accent colour is too pale would
  // be discarding the right thing for the wrong reason — the admin fixes colours in the editor.
  const structural = checkDesign(document).issues.filter(
    (issue) => issue.severity === "high" && issue.code.startsWith("structure-")
  );
  if (structural.length > 0) {
    console.warn("[importFromUrl] 構成の検査に落ちたため既定の構成に戻します。", structural);
    const fallback = archetypeBlocks("one-page-classic");
    document.pages = fallback.pages;
    document.blocks = applySampleCopy(fallback.blocks);
    warnings.push(
      "参考サイトの構成をうまく読み取れなかったため、標準のページ構成で作成しました。編集画面でセクションを入れ替えられます。"
    );
  }

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

  // The few photographs that decide whether the preview reads as a design or as a wireframe: the
  // logo (in the header of every page) and the opening image. The rest are left to the admin's
  // 「写真を作る」 button, so a template that gets thrown away costs five pictures and not twenty.
  //
  // ⚠️ Not awaited. Cloudflare cuts any origin response at 100 seconds and this request has already
  // spent a model call on the analysis — the same reason `void runGeneration(slug)` exists in
  // contentActions.ts. A failure here leaves a template with placeholder images, which is exactly
  // what it had a moment ago, so it must not be allowed to fail the import.
  void illustrateTemplate(saved, { limit: INITIAL_IMAGE_COUNT }).catch((err) => {
    console.warn("[importFromUrl] テンプレートの写真生成に失敗しました。", err);
  });

  return { document: saved, signals, previewUrl, warnings };
}
