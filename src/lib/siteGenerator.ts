import { access, cp, mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import {
  getTemplateDefinition,
  getTemplateImageManifest,
  TEMPLATES_DIR,
  type TemplateLinkSlot,
  type TemplateRepeatableGroup,
  type TemplateSection,
} from "./templates";
import type { HearingSheet } from "./hearing";
import { collectImageTargets, collectTextTargets, HIDDEN_TEXT_VALUE, isPhoneLikeText, type ImageTarget } from "./htmlContent";
import type { ImageCategoryKey } from "./imageCategories";
import { generateSiteCopy } from "./openai/generateSiteCopy";
import { generateSiteImage } from "./openai/generateSiteImage";
import { matchImagesToCategories } from "./openai/matchImageCategories";
import { planGeneration, type RepeatableGroupInfo } from "./openai/planGeneration";

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

/** Marks every element matched by a `protectText: true` linkSlot with `data-ai-skip` so the copy AI
 * never sees (and can't rewrite) its visible text — only `applyLinkSlots` touches these afterward, and
 * only the href/src. Must run before `collectTextTargets` so the walk actually skips them; a fixed CTA
 * label (e.g. a LINE button) must never be replaced with a raw ID or any AI-authored wording. */
function protectLinkText($: cheerio.CheerioAPI, linkSlots: TemplateLinkSlot[]): void {
  for (const slot of linkSlots) {
    if (!slot.protectText) continue;
    $(slot.selector).attr("data-ai-skip", "true");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The real on-page pixel size for an image target, from the template's declared `imageSlots` — used
 * to ask the image model for a matching aspect ratio instead of always generating a square. Matched by
 * exact path first; a dynamically-templated staff photo (`images/staff-0.jpg`, ...) has no exact slot
 * of its own, so it falls back to any declared `staff_*` slot's size (all staff cards share the same
 * declared photo dimensions in this template, regardless of how many per-person slots exist). */
function resolveImageTargetSize(
  template: { imageSlots: { id: string; path: string; size?: { width: number; height: number } }[] },
  image: ImageTarget
): { width: number; height: number } | undefined {
  const exact = template.imageSlots.find((slot) => slot.path === image.path);
  if (exact?.size) return exact.size;
  if (/^images\/staff-\d+\.[a-z0-9]+$/i.test(image.path)) {
    return template.imageSlots.find((slot) => slot.id.startsWith("staff_"))?.size;
  }
  return undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Current number of items rendered in a repeatable group's container (e.g. how many FAQ Q&A pairs
 * currently exist), used both as AI context and as the fallback when the AI doesn't decide a count. */
function countRepeatableItems($: cheerio.CheerioAPI, group: TemplateRepeatableGroup): number {
  const $container = $(group.container);
  if ($container.length === 0) return 0;
  return Math.floor($container.children(group.itemSelector).length / group.unitSize);
}

/** Clones or removes whole items (each item = `unitSize` consecutive matched children, e.g. one
 * `.list-half` div, or one `dt`+`dd` pair) within a repeatable group's container until it holds exactly
 * `targetCount` items — the declared, template-agnostic mechanism for sections whose static markup
 * ships with a fixed item count that must track real (or AI-decided) cardinality instead.
 * Returns each item's raw elements (length `unitSize`, in final order) — callers wrap whichever
 * element they need (a single wrapper div, or each sibling of a dt/dd pair) with `$(...)` themselves. */
function applyRepeatableGroup(
  $: cheerio.CheerioAPI,
  group: TemplateRepeatableGroup,
  targetCount: number
): import("domhandler").Element[][] {
  const $container = $(group.container);
  if ($container.length === 0) return [];

  const items = $container.children(group.itemSelector).toArray();
  const units = chunk(items, group.unitSize);
  const currentCount = units.length;

  if (targetCount < currentCount) {
    for (const unit of units.slice(targetCount)) {
      unit.forEach((el) => $(el).remove());
    }
  } else if (targetCount > currentCount && units.length > 0) {
    const templateUnit = units[units.length - 1];
    let lastEls = templateUnit;
    for (let i = currentCount; i < targetCount; i++) {
      const clones = templateUnit.map((el) => $(el).clone());
      let anchor = $(lastEls[lastEls.length - 1]);
      for (const clone of clones) {
        anchor.after(clone);
        anchor = clone;
      }
      lastEls = clones.map((c) => c.get(0)!);
    }
  }

  const finalItems = $container.children(group.itemSelector).toArray();
  return chunk(finalItems, group.unitSize);
}

/** Reads the structured records (if any) a hearing-sourced repeatable group is bound to. */
function getHearingRecords(group: TemplateRepeatableGroup, hearing: HearingSheet): Record<string, string>[] | null {
  if (group.source === "hearing.staffMembers") {
    return (hearing.staffMembers ?? []).map((m) => ({
      name: m.name,
      comment: m.comment,
      role: m.role ?? "",
      photoUrl: m.photoUrl ?? "",
    }));
  }
  if (group.source === "hearing.faqs") {
    return (hearing.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer }));
  }
  return null;
}

/** Fills an optional field (e.g. a staff member's role): shown with the given text when present,
 * hidden (never left showing stale/placeholder text) when the hearing sheet left it blank. */
function setOptionalField($el: ReturnType<cheerio.CheerioAPI>, value: string): void {
  if (value) {
    $el.text(value).removeAttr("style");
  } else {
    $el.text("").attr("style", "display:none");
  }
}

/** Binds real hearing-sheet records into freshly resized item elements, skipping the copy-AI pass
 * entirely for this content (`data-ai-skip`) since it's exact, already-known data. Field selectors
 * (relative to the item's root element) come from the group's own `fields` declaration, falling back
 * to sensible defaults for templates that don't declare one. Returns a `path -> uploaded URL` map for
 * any record that supplied its own real photo (e.g. a staff member's uploaded portrait) — the caller
 * uses this to route that exact placement to the upload instead of AI generation. */
function bindHearingRecords(
  $: cheerio.CheerioAPI,
  group: TemplateRepeatableGroup,
  units: import("domhandler").Element[][],
  records: Record<string, string>[]
): Record<string, string> {
  const fields = group.fields ?? {};
  const forcedImageUrls: Record<string, string> = {};

  records.forEach((record, i) => {
    const unit = units[i];
    if (!unit) return;

    if (group.source === "hearing.staffMembers") {
      const $root = $(unit[0]);
      $root.attr("id", `staff-${i}`);
      $root.attr("data-ai-skip", "true");
      $root.find(fields.name ?? "h3").first().text(record.name);
      $root.find(fields.comment ?? "p").first().text(record.comment);
      if (fields.role) {
        setOptionalField($root.find(fields.role).first(), record.role);
      }
      const $img = $root.find(fields.image ?? "img").first();
      if ($img.length > 0) {
        const path = `images/staff-${i}.jpg`;
        $img.attr("src", path);
        $img.attr("alt", record.role ? `${record.name}（${record.role}）` : record.name);
        if (record.photoUrl) {
          forcedImageUrls[path] = record.photoUrl;
        }
      }
    } else if (group.source === "hearing.faqs") {
      const [dt, dd] = unit;
      if (dt) $(dt).attr("data-ai-skip", "true").text(record.question);
      if (dd) $(dd).attr("data-ai-skip", "true").text(record.answer);
    }
  });

  return forcedImageUrls;
}

/** Hides a section (and its nav link) the same way the sectionVisibility plan does — shared so the
 * "no real data at all" case (e.g. zero staff members) can force a section closed deterministically,
 * without waiting on / second-guessing the AI's judgement call. */
function hideSection($: cheerio.CheerioAPI, sections: TemplateSection[], sectionId: string): void {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return;
  $(section.selector).attr("data-visible", "false");
  for (const href of section.navHrefs) {
    $(`a[href="${href}"]`).closest("li").attr("style", "display:none");
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

  // Fixed CTA labels (e.g. a LINE button's "LINE予約はこちら") must never be handed to the copy AI —
  // must run before any text-target collection below.
  protectLinkText($, template.linkSlots);

  // --- repeatable groups: for each declared group, real hearing data (if any) wins and is bound
  // deterministically right away; otherwise it's deferred to the AI — either because the group is
  // declared "ai"-sourced outright, or because it's hearing-sourced but empty and declares an "ai"
  // fallback (e.g. FAQ: use real Q&A if given, else let the AI invent some). Must run before
  // image/text target collection so the AI-facing passes below see the final DOM shape. ---
  const deferredToAiGroups: TemplateRepeatableGroup[] = [];
  const forcedImageUrlsByPath: Record<string, string> = {};

  for (const group of template.repeatableGroups) {
    if (group.source === "ai") {
      deferredToAiGroups.push(group);
      continue;
    }
    const records = getHearingRecords(group, hearing);
    if (records && records.length > 0) {
      const count = clamp(records.length, group.min, group.max);
      const units = applyRepeatableGroup($, group, count);
      Object.assign(forcedImageUrlsByPath, bindHearingRecords($, group, units, records));
    } else if (group.fallback === "ai") {
      deferredToAiGroups.push(group);
    } else {
      applyRepeatableGroup($, group, 0);
      if (group.sectionId) {
        hideSection($, template.sections, group.sectionId);
      }
    }
  }

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
  const repeatableGroupInfo: RepeatableGroupInfo[] = deferredToAiGroups.map((group) => ({
    id: group.id,
    label: group.label,
    min: group.min,
    max: group.max,
    currentCount: countRepeatableItems($, group),
  }));
  const imageSizeHints: Record<string, { width: number; height: number }> = {};
  for (const image of imageTargets) {
    const size = resolveImageTargetSize(template, image);
    if (size) imageSizeHints[image.id] = size;
  }
  const [categoryAssignment, plan] = await Promise.all([
    availableCategories.length > 0
      ? matchImagesToCategories(
          imageTargets,
          availableCategories.map((key) => ({ key, sampleUrl: uploadedImages[key]![0] })),
          imageSizeHints
        )
      : Promise.resolve({} as Record<string, ImageCategoryKey | null>),
    planGeneration(
      hearing,
      template.sections,
      imageTargets,
      imageSizeHints,
      template.layout,
      repeatableGroupInfo,
      currentCustomCss,
      template.guideSummary,
      imageManifest
    ),
  ]);

  for (const section of template.sections) {
    if (!section.removable) continue;
    if (plan.sectionVisibility[section.id] === false) {
      hideSection($, template.sections, section.id);
    }
  }

  // AI-decided repeatable groups (e.g. FAQ entry count) — resolved after the plan, and still before
  // text-target collection so the copy pass sees (and fills) exactly the right number of items.
  for (const group of deferredToAiGroups) {
    const current = countRepeatableItems($, group);
    const chosen = plan.repeatableCounts[group.id];
    const count = clamp(chosen ?? current, group.min, group.max);
    applyRepeatableGroup($, group, count);
  }

  // --- text: discover every real piece of copy on the page, not just the handful of
  // declared contentSlots (those are only a color/section-visibility index, see
  // TEMPLATE_VARIABLES.md) ---
  const { targets: textTargets, apply: applyText } = collectTextTargets($);
  const phoneTargetIds = new Set(textTargets.filter((t) => isPhoneLikeText(t.text)).map((t) => t.id));
  const copyTargets = textTargets.filter((t) => !phoneTargetIds.has(t.id));

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
    // A record-level upload (e.g. a staff member's own uploaded photo) always wins — it's a direct,
    // unambiguous match, unlike the AI category-classification pass below which is a best guess.
    const forcedUrl = forcedImageUrlsByPath[image.path];
    const category = categoryAssignment[image.id];
    const url = forcedUrl ?? (category ? nextUploadedUrl(category) : undefined);
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
        style: plan.imagePlans[image.id]?.style,
        targetSize: imageSizeHints[image.id],
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
