import { access, cp, mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { getTemplateDefinition, getTemplateImageManifest, TEMPLATES_DIR, type TemplateLinkSlot } from "./templates";
import type { HearingSheet } from "./hearing";
import { collectImageTargets, collectTextTargets, HIDDEN_TEXT_VALUE, isPhoneLikeText, type ImageTarget } from "./htmlContent";
import type { ImageCategoryKey } from "./imageCategories";
import { generateSiteCopy } from "./openai/generateSiteCopy";
import { generateSiteImage } from "./openai/generateSiteImage";
import { matchImagesToCategories } from "./openai/matchImageCategories";
import { planGeneration } from "./openai/planGeneration";

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

/** Merges `{cssVar: value}` pairs into an existing `style="--a:1;--b:2"` attribute string,
 * overwriting any variable already present and preserving the rest. */
function mergeInlineStyle(existing: string | undefined, updates: Record<string, string>): string {
  const declarations = new Map<string, string>();
  for (const decl of (existing ?? "").split(";")) {
    const [prop, ...rest] = decl.split(":");
    const name = prop?.trim();
    if (!name) continue;
    declarations.set(name, rest.join(":").trim());
  }
  for (const [name, value] of Object.entries(updates)) {
    declarations.set(name, value);
  }
  return Array.from(declarations.entries())
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

/** Resolves a hearing-sheet field into the exact string a linkSlot's `href` template expects —
 * digits/plus only for `tel:`, URL-encoded for the LINE ID and the maps query. */
function resolveHearingFieldValue(field: string, hearing: HearingSheet): string | null {
  switch (field) {
    case "phone":
      return hearing.phone ? hearing.phone.replace(/[^\d+]/g, "") : null;
    case "line": {
      if (!hearing.line) return null;
      const id = hearing.line.trim();
      return encodeURIComponent(id.startsWith("@") ? id : `@${id}`);
    }
    case "address":
      return hearing.address ? encodeURIComponent(hearing.address) : null;
    default:
      return null;
  }
}

/** Applies variables.json's `linkSlots`: fills each link/iframe from the matching hearing-sheet
 * field, or hides it (its `<li>` if it has one) when there's no real value to point it at —
 * never leaves a link pointed at the template's sample number/map/account. */
function applyLinkSlots($: cheerio.CheerioAPI, linkSlots: TemplateLinkSlot[], hearing: HearingSheet): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hide(el: any) {
    const $el = $(el);
    const $li = $el.closest("li");
    ($li.length ? $li : $el).attr("style", "display:none");
  }

  for (const slot of linkSlots) {
    const $matches = $(slot.selector);
    if ($matches.length === 0) continue;

    if (slot.connect === "hide-if-missing") {
      $matches.each((_, el) => hide(el));
      continue;
    }
    if (!slot.connect.startsWith("hearing.") || !slot.href) continue;

    const field = slot.connect.slice("hearing.".length);
    const value = resolveHearingFieldValue(field, hearing);
    if (!value) {
      $matches.each((_, el) => hide(el));
      continue;
    }

    const url = slot.href.replace(`{${field}}`, value);
    $matches.each((_, el) => {
      const $el = $(el);
      $el.attr($el.is("iframe") ? "src" : "href", url);
    });
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

  // --- generation plan: variables.json's own sectionGuide/imageGuide/textGuide/linkGuide (plus the
  // removed-images manifest) are the template's own documentation of what each section/image is
  // actually for — use them to decide which optional sections make sense to show, and to write a
  // role-appropriate image prompt per placement (a logo needs a flat vector mark, not a photo). ---
  const imageManifest = await getTemplateImageManifest(template.dirName);
  const customCssPath = path.join(outDir, template.customCssFile);
  const currentCustomCss = await readFile(customCssPath, "utf-8").catch(() => "");
  const [categoryAssignment, plan] = await Promise.all([
    availableCategories.length > 0
      ? matchImagesToCategories(
          imageTargets,
          availableCategories.map((key) => ({ key, sampleUrl: uploadedImages[key]![0] }))
        )
      : Promise.resolve({} as Record<string, ImageCategoryKey | null>),
    planGeneration(
      hearing,
      template.sections,
      imageTargets,
      template.layout,
      currentCustomCss,
      template.guideSummary,
      imageManifest
    ),
  ]);

  for (const section of template.sections) {
    if (!section.removable) continue;
    if (plan.sectionVisibility[section.id] === false) {
      $(section.selector).attr("data-visible", "false");
      for (const href of section.navHrefs) {
        $(`a[href="${href}"]`).closest("li").attr("style", "display:none");
      }
    }
  }

  // Layout knobs (column counts, spacing, ...) are declared in variables.json as CSS custom
  // properties written onto <html style="...">; apply whatever the plan chose, within the
  // template's own documented bounds.
  const layoutStyleUpdates: Record<string, string> = {};
  for (const [key, knob] of Object.entries(template.layout)) {
    const chosen = plan.layoutValues[key];
    if (chosen === undefined) continue;
    if (knob.min !== undefined && knob.max !== undefined) {
      const numeric = Math.round(Number(chosen));
      layoutStyleUpdates[knob.cssVar] = Number.isFinite(numeric)
        ? String(Math.min(knob.max, Math.max(knob.min, numeric)))
        : String(knob.value);
    } else {
      layoutStyleUpdates[knob.cssVar] = chosen;
    }
  }
  if (Object.keys(layoutStyleUpdates).length > 0) {
    $("html").attr("style", mergeInlineStyle($("html").attr("style"), layoutStyleUpdates));
  }

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
        customPrompt: plan.imagePlans[image.id]?.prompt,
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

  // linkSlots (declared in variables.json) are attributes, not visible text, so the copy pass never
  // touches them — without this they'd stay pointed at the template's sample number/map/account
  // forever. Each is either filled from a real hearing-sheet value or, per the template's own
  // policy, hidden entirely rather than left pointing at fake data.
  applyLinkSlots($, template.linkSlots, hearing);

  // Sample content the template author flagged as never real (dummy phone/menus, distributor manual
  // links, a fabricated doctor schedule, ...) — hide unconditionally, or only when the hearing sheet
  // truly has nothing to replace it with.
  for (const target of template.virtualMaterialTargets) {
    const shouldHide =
      target.action === "hide" ||
      target.action === "hide-if-no-staff-data" ||
      (target.action === "hide-if-no-address" && !hearing.address);
    if (!shouldHide) continue;
    $(target.selector).each((_, el) => {
      const $el = $(el);
      const $li = $el.closest("li");
      ($li.length ? $li : $el).attr("style", "display:none");
    });
  }

  await writeFile(htmlPath, $.html(), "utf-8");

  if (plan.customCss.trim()) {
    await mkdir(path.dirname(customCssPath), { recursive: true });
    await writeFile(customCssPath, plan.customCss, "utf-8");
  }

  for (const { image, buffer } of [...aiImages, ...uploadedImageFiles]) {
    const imagePath = path.join(outDir, image.path);
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, buffer);
  }

  const variablesPath = path.join(outDir, "variables.json");
  try {
    const raw = await readFile(variablesPath, "utf-8");
    const data = JSON.parse(raw) as {
      colorScheme?: { active?: string };
      sections?: { id: string; visible?: boolean }[];
      layout?: Record<string, { value?: string | number }>;
      customCss?: { content?: string };
    };
    if (data.colorScheme) {
      data.colorScheme.active = hearing.colorScheme;
    }
    for (const section of data.sections ?? []) {
      if (plan.sectionVisibility[section.id] !== undefined) {
        section.visible = plan.sectionVisibility[section.id];
      }
    }
    for (const [key, knob] of Object.entries(data.layout ?? {})) {
      if (plan.layoutValues[key] !== undefined) {
        knob.value = plan.layoutValues[key];
      }
    }
    if (data.customCss && plan.customCss.trim()) {
      data.customCss.content = plan.customCss;
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
