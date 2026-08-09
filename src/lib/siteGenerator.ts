import { access, cp, mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { getTemplateDefinition, TEMPLATES_DIR } from "./templates";
import type { HearingSheet } from "./hearing";
import { collectImageTargets, collectTextTargets, HIDDEN_TEXT_VALUE, isPhoneLikeText, type ImageTarget } from "./htmlContent";
import type { ImageCategoryKey } from "./imageCategories";
import { generateSiteCopy } from "./openai/generateSiteCopy";
import { generateSiteImage } from "./openai/generateSiteImage";
import { matchImagesToCategories } from "./openai/matchImageCategories";

const EXCLUDED_FILES = new Set([".DS_Store", "AI_GUIDE.md", "_removed_images_manifest.md"]);
const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");
/** Cap concurrent OpenAI image calls — a single page can reference 15-25 distinct images. */
const IMAGE_CONCURRENCY = 3;

export type GeneratedSite = {
  slug: string;
  previewUrl: string;
};

/** `hearing.previewUrl` only records that generation once succeeded — it's never cleared if the
 * output directory is later removed (manual cleanup, a killed dev server mid-write, etc.), so
 * callers must confirm the files are still actually there before trusting it. */
export async function generatedSiteExists(slug: string): Promise<boolean> {
  try {
    await access(path.join(GENERATED_ROOT, slug));
    return true;
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function generateSite(hearing: HearingSheet): Promise<GeneratedSite> {
  const template = await getTemplateDefinition(hearing.templateId);
  if (!template) {
    throw new Error("選択されたテンプレートが見つかりません。");
  }

  const srcDir = path.join(TEMPLATES_DIR, template.dirName);
  const outDir = path.join(GENERATED_ROOT, hearing.slug);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(GENERATED_ROOT, { recursive: true });
  await cp(srcDir, outDir, {
    recursive: true,
    filter: (source) => !EXCLUDED_FILES.has(path.basename(source)),
  });

  const htmlPath = path.join(outDir, template.htmlFile);
  const html = await readFile(htmlPath, "utf-8");
  const $ = cheerio.load(html);

  $("html").attr("data-theme", hearing.colorScheme);

  // --- text: discover every real piece of copy on the page, not just the handful of
  // declared contentSlots (those are only a color/section-visibility index, see
  // TEMPLATE_VARIABLES.md) ---
  const { targets: textTargets, apply: applyText } = collectTextTargets($);
  const phoneTargetIds = new Set(textTargets.filter((t) => isPhoneLikeText(t.text)).map((t) => t.id));
  const copyTargets = textTargets.filter((t) => !phoneTargetIds.has(t.id));

  // --- images: every distinct local <img> the page actually references. Logo/decorative images are
  // never sourced from uploads (there's no "logo" category) — only the 5 photo categories are. AI
  // decides, per image placement, which uploaded category (if any) fits; the rest are AI-generated. ---
  const imageTargets = collectImageTargets($);
  const uploadedImages = hearing.uploadedImages ?? {};
  const availableCategories = (Object.keys(uploadedImages) as ImageCategoryKey[]).filter(
    (key) => (uploadedImages[key]?.length ?? 0) > 0
  );

  const categoryAssignment =
    availableCategories.length > 0
      ? await matchImagesToCategories(
          imageTargets,
          availableCategories.map((key) => ({ key, sampleUrl: uploadedImages[key]![0] }))
        )
      : {};

  // Each uploaded photo is used at most once per site — once a category runs out, remaining
  // placements fall through to AI generation instead of repeating an already-used photo.
  const categoryCursors: Partial<Record<ImageCategoryKey, number>> = {};
  function nextUploadedUrl(category: ImageCategoryKey): string | undefined {
    const urls = uploadedImages[category];
    if (!urls || urls.length === 0) return undefined;
    const cursor = categoryCursors[category] ?? 0;
    if (cursor >= urls.length) return undefined;
    categoryCursors[category] = cursor + 1;
    return urls[cursor];
  }

  const uploadedImageTargets: { image: ImageTarget; url: string }[] = [];
  const aiImageTargets: ImageTarget[] = [];
  for (const image of imageTargets) {
    const category = categoryAssignment[image.id];
    const url = category ? nextUploadedUrl(category) : undefined;
    if (url) {
      uploadedImageTargets.push({ image, url });
    } else {
      aiImageTargets.push(image);
    }
  }

  const [copyMap, aiImages, uploadedImageFiles] = await Promise.all([
    generateSiteCopy(hearing, copyTargets),
    mapWithConcurrency(aiImageTargets, IMAGE_CONCURRENCY, async (image, index) => ({
      image,
      buffer: await generateSiteImage(hearing, {
        label: image.alt || `${template.label}の画像（${image.path}）`,
        variationHint: `${index + 1}/${aiImageTargets.length}`,
      }),
    })),
    Promise.all(
      uploadedImageTargets.map(async ({ image, url }) => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`アップロード画像の取得に失敗しました（${url}）。`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        return { image, buffer };
      })
    ),
  ]);

  for (const [id, value] of Object.entries(copyMap)) {
    applyText(id, value);
  }

  // Contact phone numbers are never left to the model — guaranteed exact when provided, hidden
  // (never a fabricated-looking placeholder like "0120-000-000") when not.
  for (const id of phoneTargetIds) {
    applyText(id, hearing.phone || HIDDEN_TEXT_VALUE);
  }
  if (hearing.phone) {
    $('a[href^="tel:"]').attr("href", `tel:${hearing.phone.replace(/[^\d+]/g, "")}`);
  }

  await writeFile(htmlPath, $.html(), "utf-8");

  for (const { image, buffer } of [...aiImages, ...uploadedImageFiles]) {
    const imagePath = path.join(outDir, image.path);
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, buffer);
  }

  const variablesPath = path.join(outDir, "variables.json");
  try {
    const raw = await readFile(variablesPath, "utf-8");
    const data = JSON.parse(raw) as { colorScheme?: { active?: string } };
    if (data.colorScheme) {
      data.colorScheme.active = hearing.colorScheme;
    }
    await writeFile(variablesPath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // variables.json is optional at this stage; skip if missing/invalid.
  }

  return {
    slug: hearing.slug,
    previewUrl: `/generated/${hearing.slug}/${template.htmlFile}`,
  };
}
