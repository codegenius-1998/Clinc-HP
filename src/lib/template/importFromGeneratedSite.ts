import { copyFile, mkdir, readFile, readdir } from "fs/promises";
import path from "path";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import * as cheerio from "cheerio";
import { getOpenAIClient } from "@/lib/openai/client";
import { DEFAULT_DESIGN_TOKENS, designTokensSchema, type Block, type DesignTokens, type SiteDocument } from "@/lib/site/document";
import { defaultTemplateBlocks } from "@/lib/site/defaultTemplate";
import { deleteDocument, newDocumentId, saveDocument } from "@/lib/site/store";
import { renderSiteFiles, siteOutputPath } from "@/lib/render/renderSiteFiles";
import { applySampleCopy } from "./sampleCopy";

/** Turns a site this system already generated into a reusable template.
 *
 * Unlike importFromUrl.ts, nothing here is guessed. A generated page carries its exact design in an
 * inline `<html style>` block (`--primary`, `--radius`, `--font`, `--space-scale`) plus a couple of
 * class names (`hero-split`, `cards-list`), so the tokens are READ rather than inferred — and its
 * photos are ours, generated for us, so they can be carried into the template instead of leaving it
 * full of grey placeholders. The model is asked only for the name, the mood text and the tags, which
 * is the part that genuinely needs judgement (the auto-selector reads `mood` and nothing else). */

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");

export type GeneratedSiteCandidate = {
  slug: string;
  title: string;
  primary: string;
  heroLayout: string;
};

/** Sites on disk that can be turned into a template — i.e. anything under public/generated that
 * isn't the reserved template output directory. */
export async function listGeneratedSites(): Promise<GeneratedSiteCandidate[]> {
  let entries: string[];
  try {
    entries = await readdir(GENERATED_ROOT);
  } catch {
    return [];
  }

  const candidates: GeneratedSiteCandidate[] = [];
  for (const slug of entries) {
    if (slug.startsWith("_") || slug.startsWith(".")) continue;
    try {
      const html = await readFile(path.join(GENERATED_ROOT, slug, "index.html"), "utf-8");
      const $ = cheerio.load(html);
      const style = $("html").attr("style") ?? "";
      candidates.push({
        slug,
        title: $("title").text().trim() || slug,
        primary: style.match(/--primary:\s*([^;]+)/)?.[1]?.trim() ?? "#000000",
        heroLayout: html.match(/class="hero hero-([a-z-]+)"/)?.[1] ?? "full-bleed",
      });
    } catch {
      continue; // not a rendered site directory
    }
  }
  return candidates.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Reads the CSS custom properties out of the page's inline `<html style>` attribute. */
function readInlineTokens(style: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const [name, ...rest] = declaration.split(":");
    if (!name?.trim().startsWith("--")) continue;
    tokens[name.trim()] = rest.join(":").trim();
  }
  return tokens;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function color(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim().toLowerCase();
  if (HEX.test(v)) return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
  return fallback;
}

const CARD_LAYOUTS = new Set(["grid", "list", "minimal", "overlap"]);
const HERO_LAYOUTS = new Set(["full-bleed", "split", "centered"]);

function tokensFromPage(html: string): DesignTokens {
  const $ = cheerio.load(html);
  const inline = readInlineTokens($("html").attr("style") ?? "");
  const d = DEFAULT_DESIGN_TOKENS;

  const cardLayout = html.match(/class="cards cards-([a-z]+)"/)?.[1];
  const heroLayout = html.match(/class="hero hero-([a-z-]+)"/)?.[1];
  const font = (inline["--font"] || d.font.bodyFamily).replace(/&quot;/g, '"');
  const radius = Number.parseFloat(inline["--radius"] ?? "");
  const spacing = Number.parseFloat(inline["--space-scale"] ?? "");

  return designTokensSchema.parse({
    colors: {
      primary: color(inline["--primary"], d.colors.primary),
      accent: color(inline["--accent"], d.colors.accent),
      light: color(inline["--light"], d.colors.light),
      background: "#ffffff",
      text: "#2b2b2b",
      primaryInverse: color(inline["--primary-inverse"], "#ffffff"),
      accentInverse: color(inline["--accent-inverse"], "#ffffff"),
    },
    font: {
      // The old renderer had a single font for the whole page; both roles inherit it so the template
      // reproduces the site exactly rather than inventing a heading face it never had.
      headingFamily: font,
      bodyFamily: font,
      googleFonts: [],
      baseSize: 16,
      lineHeight: 1.8,
      headingWeight: 700,
    },
    block: {
      radius: Number.isFinite(radius) ? Math.min(48, Math.max(0, radius)) : d.block.radius,
      borderWidth: 1,
      borderColor: "#eeeeee",
      shadow: "soft",
      cardLayout: cardLayout && CARD_LAYOUTS.has(cardLayout) ? cardLayout : d.block.cardLayout,
    },
    layout: {
      heroLayout: heroLayout && HERO_LAYOUTS.has(heroLayout) ? heroLayout : d.layout.heroLayout,
      maxWidth: 1080,
      spacingScale: Number.isFinite(spacing) ? Math.min(2, Math.max(0.7, spacing)) : 1,
      sectionDivider: "none",
    },
    // What the old main.js/site.css did for every site: a 0.7s fade-and-rise, no stagger, no parallax.
    animation: { reveal: "slide-up", duration: 700, stagger: false, parallaxHero: false },
  });
}

const describeSchema = z.object({
  name: z.string(),
  mood: z.string(),
  tags: z.array(z.string()),
});

/** The only judgement call in this importer: how to describe the design so the auto-selector can
 * later match it to a hearing sheet. */
async function describeDesign(design: DesignTokens, pageTitle: string, headline: string) {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      {
        role: "system",
        content: `あなたはWebデザインのディレクターです。渡されたデザイン設定から、そのテンプレートの名前・雰囲気・タグを日本語で決めてください。
- name: 15文字以内。「〜系」「〜調」のように雰囲気が伝わる短い名前。
- mood: 2〜3文。このテンプレートがどんなクリニックに合うかを書く。あとで別のAIがヒアリング内容と照らして自動選択する際の唯一の判断材料になるので、色コードやフォント名ではなく「誰に・どんな印象を与えるか」を書くこと。
- tags: 3〜6個の短い日本語タグ（例: 小児科向け, 明るい, 高級感, 和モダン）。`,
      },
      {
        role: "user",
        content: [
          `参考サイト: ${pageTitle}`,
          headline && `キャッチコピー: ${headline}`,
          `メインカラー: ${design.colors.primary} / アクセント: ${design.colors.accent} / 淡色: ${design.colors.light}`,
          `フォント: ${design.font.bodyFamily}`,
          `角丸: ${design.block.radius}px / カードの並べ方: ${design.block.cardLayout}`,
          `メインビジュアル: ${design.layout.heroLayout} / 余白: ${design.layout.spacingScale}倍`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    text: { format: zodTextFormat(describeSchema, "template_description") },
  });
  return response.output_parsed as z.infer<typeof describeSchema> | null;
}

/** Copies the source site's photos into the template and points its sample blocks at them. These are
 * images this system generated for its own sites, so unlike a third-party reference URL there is
 * nothing to avoid reusing — and a template that previews with real photos is far easier to judge. */
async function adoptImages(sourceSlug: string, target: SiteDocument, blocks: Block[]): Promise<{ blocks: Block[]; logo: string }> {
  const sourceDir = path.join(GENERATED_ROOT, sourceSlug, "images");
  const { outDir } = siteOutputPath(target);
  await mkdir(path.join(outDir, "images"), { recursive: true });

  let available: string[] = [];
  try {
    available = await readdir(sourceDir);
  } catch {
    return { blocks, logo: "images/placeholder.svg" };
  }

  for (const file of available) {
    await copyFile(path.join(sourceDir, file), path.join(outDir, "images", file)).catch(() => {});
  }

  const has = (file: string) => (available.includes(file) ? `images/${file}` : undefined);
  const departmentPhotos = available.filter((f) => /^department-\d+\./.test(f)).sort().map((f) => `images/${f}`);

  // Section images are matched by the filename the old generator used for that section.
  const sectionImage: Record<string, string | undefined> = {
    greeting: has("greeting.jpg"),
    facility: has("facility.jpg"),
  };

  const next = blocks.map((block): Block => {
    if (block.type === "hero") {
      const image = has("hero.jpg");
      return image ? { ...block, data: { ...block.data, image } } : block;
    }
    if (block.type === "rich") {
      const own = sectionImage[block.id];
      const cards = block.data.cards.map((card, i) => ({
        ...card,
        image: departmentPhotos[i % Math.max(1, departmentPhotos.length)] ?? card.image,
      }));
      return { ...block, data: { ...block.data, ...(own ? { image: own } : {}), cards } };
    }
    return block;
  });

  return { blocks: next, logo: has("header.png") ?? has("logo.png") ?? "images/placeholder.svg" };
}

export type GeneratedImportResult = { document: SiteDocument; previewUrl: string };

export async function importTemplateFromGeneratedSite(slug: string, nameOverride?: string): Promise<GeneratedImportResult> {
  const safeSlug = path.basename(slug);
  const html = await readFile(path.join(GENERATED_ROOT, safeSlug, "index.html"), "utf-8").catch(() => {
    throw new Error(`生成済みサイトが見つかりません（${slug}）。`);
  });

  const $ = cheerio.load(html);
  const design = tokensFromPage(html);
  const pageTitle = $("title").text().trim();
  const headline = $(".hero-copy h1").first().text().trim();

  const described = await describeDesign(design, pageTitle, headline).catch(() => null);
  const name = (nameOverride ?? described?.name ?? "").trim() || `${safeSlug} 由来のテンプレート`;

  const now = new Date().toISOString();
  const id = newDocumentId();
  const base: SiteDocument = {
    id,
    slug: `template-${id.slice(0, 8)}`,
    name,
    isTemplate: true,
    canSell: false,
    design,
    meta: {
      clinicName: "サンプルクリニック",
      phone: "00-0000-0000",
      line: "@sample",
      address: "東京都〇〇区〇〇 1-2-3",
      logoImage: "images/placeholder.svg",
      seo: {
        title: `${name}｜テンプレートプレビュー`,
        metaDescription: (described?.mood ?? "").slice(0, 120),
        ogTitle: name,
        ogDescription: (described?.mood ?? "").slice(0, 120),
        ogSiteName: name,
      },
      snsLinks: [],
    },
    blocks: applySampleCopy(defaultTemplateBlocks()),
    mood: described?.mood,
    tags: (described?.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
    sourceUrl: `/generated/${safeSlug}/index.html`,
    createdAt: now,
    updatedAt: now,
  };

  const { blocks, logo } = await adoptImages(safeSlug, base, base.blocks);
  const document: SiteDocument = { ...base, blocks, meta: { ...base.meta, logoImage: logo } };

  let saved;
  try {
    saved = await saveDocument(document);
  } catch (err) {
    await deleteDocument(document.id).catch(() => {});
    throw err;
  }

  const { previewUrl } = await renderSiteFiles(saved);
  return { document: saved, previewUrl };
}
