import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { renderSiteFiles, siteOutputPath } from "./render/renderSiteFiles";
import { instantiateTemplate, saveDocument } from "./site/store";
import { selectTemplate } from "./template/selectTemplate";
import { generateContentPlan, type ContentPlan, type ImageAspect } from "./openai/generateContentPlan";
import { generateSiteImage, type ImageStyle } from "./openai/generateSiteImage";
import { matchImagesToCategories, type ImageTarget as CategoryImageTarget } from "./openai/matchImageCategories";
import type { HearingSheet } from "./hearing";
import type { Block, SiteDocument } from "./site/document";
import type { ImageCategoryKey } from "./imageCategories";

/** Builds one clinic site: pick a template, clone it, write the copy, generate the images, save the
 * document, render the files.
 *
 * The document is the deliverable here, not the HTML. Everything the page shows now round-trips
 * through D1, which is what makes the editor possible at all — the pre-block generator threw its
 * view model away and left only an HTML file that nothing could edit. Rendering is a separate,
 * AI-free step (renderSiteFiles) that the editor calls on every save. */

const IMAGE_CONCURRENCY = 3;

export type GeneratedSite = {
  documentId: string;
  slug: string;
  previewUrl: string;
  templateId: string;
  templateName: string;
  /** One-line explanation of why the auto-selector chose that template, when an AI call decided it. */
  templateReason: string | null;
};

// --- hearing sheet -> factual block content ------------------------------------------------------

/** Splits `hearing.hours` (free-form, newline-separated) into table rows, pulling a "label：value"
 * shape apart where present. Deterministic — never routed through the AI, so it can never drift from
 * what the clinic actually typed (see HONESTY_RULES). */
function hoursRowsFromHearing(hearing: HearingSheet): { label: string; value: string }[] {
  return (hearing.hours ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^(.*?)[：:](.*)$/);
      return match ? { label: match[1].trim(), value: match[2].trim() } : { label: "", value: line };
    });
}

/** Hides the blocks the clinic gave us nothing to fill. An empty 料金表 is worse than no 料金表: the
 * section would render as a heading over a blank table, which reads as a broken page rather than as
 * an omission. Applied BEFORE the content plan is requested so the model never writes copy for a
 * section that won't ship. */
function applyFactualVisibility(doc: SiteDocument, hearing: HearingSheet): void {
  const has = {
    hours: (hearing.hours ?? "").trim().length > 0,
    access: (hearing.address ?? "").trim().length > 0,
    staff: (hearing.staffMembers?.length ?? 0) > 0,
    pricing: (hearing.priceItems?.length ?? 0) > 0,
  };
  for (const block of doc.blocks) {
    if (block.type === "hours") block.visible = block.visible && has.hours;
    if (block.type === "access") block.visible = block.visible && has.access;
    if (block.type === "staff") block.visible = block.visible && has.staff;
    if (block.type === "pricing") block.visible = block.visible && has.pricing;
  }
}

/** Copies the hearing sheet's hard facts into the blocks that report them. This copy is what makes
 * the site editable later: from here on the document is the source of truth, and re-reading the
 * hearing sheet at render time (which the old generator did) would silently undo the user's edits. */
function applyFactualContent(doc: SiteDocument, hearing: HearingSheet, plan: ContentPlan): void {
  const hoursRows = hoursRowsFromHearing(hearing);

  for (const block of doc.blocks) {
    switch (block.type) {
      case "hours":
        block.data.rows = hoursRows;
        break;
      case "access":
        block.data.address = hearing.address ?? "";
        block.data.mapQuery = hearing.address ? encodeURIComponent(hearing.address) : "";
        break;
      case "pricing":
        block.data.items = (hearing.priceItems ?? []).map((item) => ({
          name: item.name,
          price: item.price,
          note: item.note,
        }));
        break;
      case "staff":
        block.data.members = (hearing.staffMembers ?? []).map((m) => ({
          name: m.name,
          role: m.role,
          comment: m.comment,
          image: undefined,
        }));
        break;
      case "news":
        // Real announcements always win; the AI's generic ones only fill an otherwise empty section.
        block.data.items =
          hearing.news && hearing.news.length > 0
            ? hearing.news.map((n) => ({ date: n.date, title: n.title }))
            : plan.newsFallback;
        break;
      case "faq":
        block.data.items = hearing.faqs && hearing.faqs.length > 0 ? hearing.faqs : plan.faqFallback;
        break;
      default:
        break;
    }
  }
}

// --- content plan -> authored block content ------------------------------------------------------

function applyContentPlan(doc: SiteDocument, plan: ContentPlan): void {
  const byId = new Map(plan.blocks.map((b) => [b.blockId, b]));

  doc.meta.seo = plan.seo;

  for (const block of doc.blocks) {
    const content = byId.get(block.id);
    if (!content) continue;

    switch (block.type) {
      case "hero":
        block.data.headline = content.heading;
        block.data.subheadline = content.body;
        break;
      case "rich":
        block.data.heading = content.heading;
        block.data.body = content.body;
        block.data.cards = content.cards.map((card) => ({ heading: card.heading, body: card.body }));
        break;
      case "contact":
        block.data.heading = content.heading;
        block.data.lead = content.body;
        break;
      case "freeText":
        block.data.heading = content.heading;
        block.data.body = content.body;
        break;
      case "gallery":
        block.data.heading = content.heading;
        break;
      case "imageBanner":
        block.data.caption = content.heading || undefined;
        break;
      default:
        break;
    }
  }
}

// --- images --------------------------------------------------------------------------------------

const ASPECT_SIZE: Record<ImageAspect, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1200, height: 900 },
  "16:9": { width: 1200, height: 675 },
  "2:1": { width: 1200, height: 600 },
};

const LOGO_SLOT = "logo";

/** Slot keys address one image placement: a block's own image, or the nth item inside it. They double
 * as output filenames, so they're kept to characters that are safe in a path and in a URL. */
function slotKey(blockId: string, index?: number): string {
  const base = index === undefined ? blockId : `${blockId}-${index}`;
  return base.replace(/[^A-Za-z0-9_-]/g, "-");
}

type ImageJob = {
  slot: string;
  /** Site-relative path written into the block, e.g. "images/hero.jpg". */
  path: string;
  alt: string;
  role: ImageStyle;
  prompt?: string;
  targetSize: { width: number; height: number };
};

/** Turns the plan's image list into concrete, collision-free output paths, then adds the placements
 * the plan never sees: the header logo (structural — a missing one leaves a broken <img> in every
 * page) and staff portraits (never AI-authored copy, so they're synthesized straight from the
 * hearing sheet). */
function buildImageJobs(doc: SiteDocument, hearing: HearingSheet, plan: ContentPlan): ImageJob[] {
  const blocksById = new Map(doc.blocks.map((b) => [b.id, b]));
  const jobs: ImageJob[] = [];
  const seen = new Set<string>();

  function push(job: ImageJob) {
    if (seen.has(job.slot)) return;
    seen.add(job.slot);
    jobs.push(job);
  }

  for (const image of plan.images) {
    if (image.blockId === LOGO_SLOT || image.role === "logo") {
      push({
        slot: LOGO_SLOT,
        path: "images/logo.png",
        alt: hearing.clinicName,
        role: "logo",
        prompt: image.prompt,
        targetSize: { width: 128, height: 128 },
      });
      continue;
    }

    const block = blocksById.get(image.blockId);
    if (!block || !block.visible) continue;
    // A card image the chosen template will never render ("minimal" drops them entirely) would be a
    // real image-generation API call spent on a file no <img> points at.
    if (image.cardIndex !== undefined && block.type === "rich" && doc.design.block.cardLayout === "minimal") continue;

    const slot = slotKey(block.id, image.cardIndex);
    push({
      slot,
      path: `images/${slot}.jpg`,
      alt: image.alt,
      role: image.role,
      prompt: image.prompt,
      targetSize: ASPECT_SIZE[image.aspect],
    });
  }

  // Structural guarantees the model can't be trusted to remember.
  push({
    slot: LOGO_SLOT,
    path: "images/logo.png",
    alt: hearing.clinicName,
    role: "logo",
    targetSize: { width: 128, height: 128 },
  });
  for (const block of doc.blocks) {
    if (block.type !== "hero" || !block.visible) continue;
    push({
      slot: slotKey(block.id),
      path: `images/${slotKey(block.id)}.jpg`,
      alt: hearing.clinicName,
      role: "photo",
      targetSize: ASPECT_SIZE["2:1"],
    });
  }
  for (const block of doc.blocks) {
    if (block.type !== "staff" || !block.visible) continue;
    block.data.members.forEach((member, i) => {
      const slot = slotKey(block.id, i);
      push({
        slot,
        path: `images/${slot}.jpg`,
        alt: member.name,
        role: "photo",
        targetSize: ASPECT_SIZE["1:1"],
      });
    });
  }

  return jobs;
}

/** Writes the finished image paths back into the blocks. Slots with no file (the model didn't plan
 * one, or generation was skipped) are left alone so a template's own sample image survives. */
function applyImagePaths(doc: SiteDocument, paths: Map<string, string>): void {
  const logo = paths.get(LOGO_SLOT);
  if (logo) doc.meta.logoImage = logo;

  for (const block of doc.blocks) {
    const own = paths.get(slotKey(block.id));
    switch (block.type) {
      case "hero":
        if (own) block.data.image = own;
        break;
      case "rich":
        if (own) block.data.image = own;
        block.data.cards = block.data.cards.map((card, i) => {
          const image = paths.get(slotKey(block.id, i));
          return image ? { ...card, image } : card;
        });
        break;
      case "imageBanner":
        if (own) block.data.image = own;
        break;
      case "gallery":
        block.data.images = block.data.images.map((image, i) => {
          const src = paths.get(slotKey(block.id, i));
          return src ? { ...image, src } : image;
        });
        break;
      case "staff":
        block.data.members = block.data.members.map((member, i) => {
          const image = paths.get(slotKey(block.id, i));
          return image ? { ...member, image } : member;
        });
        break;
      default:
        break;
    }
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

/** Resolves every image placement to bytes on disk. A photo the clinic actually uploaded always beats
 * an invented one, so uploads are matched to placements first (by category, via the AI matcher) and
 * only the leftovers are generated. Each uploaded photo is used at most once. */
async function produceImages(
  doc: SiteDocument,
  hearing: HearingSheet,
  jobs: ImageJob[],
  outDir: string
): Promise<Map<string, string>> {
  const uploadedImages = hearing.uploadedImages ?? {};
  const availableCategories = (Object.keys(uploadedImages) as ImageCategoryKey[]).filter(
    (key) => (uploadedImages[key]?.length ?? 0) > 0
  );

  const matchableJobs = jobs.filter((job) => job.role !== "logo");
  const categoryAssignment: Record<string, ImageCategoryKey | null> =
    availableCategories.length > 0 && matchableJobs.length > 0
      ? await matchImagesToCategories(
          matchableJobs.map((job): CategoryImageTarget => ({ id: job.slot, alt: job.alt })),
          availableCategories.map((key) => ({ key, sampleUrl: uploadedImages[key]![0] }))
        )
      : {};

  const categoryCursors: Partial<Record<ImageCategoryKey, number>> = {};
  function nextUploadedUrl(category: ImageCategoryKey): string | undefined {
    const urls = uploadedImages[category];
    if (!urls || urls.length === 0) return undefined;
    const cursor = categoryCursors[category] ?? 0;
    if (cursor >= urls.length) return undefined;
    categoryCursors[category] = cursor + 1;
    return urls[cursor];
  }

  // A staff member who supplied their own photo must get that photo, not a category match.
  const forcedUrls = new Map<string, string>();
  for (const block of doc.blocks) {
    if (block.type !== "staff") continue;
    (hearing.staffMembers ?? []).forEach((member, i) => {
      if (member.photoUrl) forcedUrls.set(slotKey(block.id, i), member.photoUrl);
    });
  }

  const uploadedJobs: { job: ImageJob; url: string }[] = [];
  const aiJobs: ImageJob[] = [];
  for (const job of jobs) {
    const url = forcedUrls.get(job.slot) ?? (categoryAssignment[job.slot] ? nextUploadedUrl(categoryAssignment[job.slot]!) : undefined);
    if (url) uploadedJobs.push({ job, url });
    else aiJobs.push(job);
  }

  const [generated, downloaded] = await Promise.all([
    mapWithConcurrency(aiJobs, IMAGE_CONCURRENCY, async (job, index) => ({
      job,
      buffer: await generateSiteImage(hearing, {
        label: job.alt || job.slot,
        variationHint: `${index + 1}/${aiJobs.length}`,
        customPrompt: job.prompt,
        style: job.role,
        targetSize: job.targetSize,
      }),
    })),
    Promise.all(
      uploadedJobs.map(async ({ job, url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`アップロード画像の取得に失敗しました（${url}）。`);
        return { job, buffer: Buffer.from(await res.arrayBuffer()) };
      })
    ),
  ]);

  const paths = new Map<string, string>();
  for (const { job, buffer } of [...generated, ...downloaded]) {
    await writeFile(path.join(outDir, job.path), buffer);
    paths.set(job.slot, job.path);
  }
  return paths;
}

// --- entry point ---------------------------------------------------------------------------------

export async function generateSite(hearing: HearingSheet): Promise<GeneratedSite> {
  const { template, reason } = await selectTemplate(hearing);

  const doc = instantiateTemplate(template, {
    slug: hearing.slug,
    name: hearing.clinicName,
    ownerEmail: hearing.ownerEmail,
  });
  doc.meta = {
    ...doc.meta,
    clinicName: hearing.clinicName,
    phone: hearing.phone ?? "",
    line: hearing.line ?? "",
    address: hearing.address ?? "",
  };

  applyFactualVisibility(doc, hearing);

  const newsBlock = doc.blocks.find((b): b is Extract<Block, { type: "news" }> => b.type === "news" && b.visible);
  const faqBlock = doc.blocks.find((b): b is Extract<Block, { type: "faq" }> => b.type === "faq" && b.visible);
  const needsNewsFallback = Boolean(newsBlock) && (hearing.news?.length ?? 0) === 0;
  const needsFaqFallback = Boolean(faqBlock) && (hearing.faqs?.length ?? 0) === 0;

  const plan = await generateContentPlan(hearing, doc, needsNewsFallback, needsFaqFallback);
  applyContentPlan(doc, plan);
  applyFactualContent(doc, hearing, plan);

  // Full regeneration replaces every image, so the old directory is cleared here — unlike
  // renderSiteFiles, which must preserve it. This is the only place that removal is correct.
  const { outDir, previewUrl } = siteOutputPath(doc);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, "images"), { recursive: true });

  const imagePaths = await produceImages(doc, hearing, buildImageJobs(doc, hearing, plan), outDir);
  applyImagePaths(doc, imagePaths);

  await saveDocument(doc);
  await renderSiteFiles(doc);

  return {
    documentId: doc.id,
    slug: doc.slug,
    previewUrl,
    templateId: template.id,
    templateName: template.name,
    templateReason: reason,
  };
}
