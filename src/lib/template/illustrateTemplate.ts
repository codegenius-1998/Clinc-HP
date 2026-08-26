import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { generateSiteImage } from "@/lib/openai/generateSiteImage";
import { renderSiteFiles, siteOutputPath } from "@/lib/render/renderSiteFiles";
import { documentImageSlots, needsGeneratedFile, LOGO_SLOT, type ImageSlot } from "@/lib/site/imagePaths";
import { applyImagePaths } from "@/lib/siteGenerator";
import { saveDocument } from "@/lib/site/store";
import type { HearingSheet } from "@/lib/hearing";
import type { SiteDocument } from "@/lib/site/document";

/** Fills a template's placeholder images with generated photographs.
 *
 * A template is saved pointing every image at `images/placeholder.svg`, deliberately, so creating one
 * costs nothing. That is fine while a template is only a starting point for a real generation — the
 * placeholder is never shown to a clinic. It is NOT fine on the screen an admin looks at to decide
 * whether the template is any good: a grid of grey placeholder icons reads as a broken product, and
 * it is the main reason a freshly imported template looks like every other one.
 *
 * ⚠️ Only slots the design actually DRAWS are filled. A `cardLayout: "minimal"` section renders no
 * card images at all, so generating them would be billed API calls for files no `<img>` points at.
 * `documentImageSlots` already knows this, which is why the list comes from there rather than from a
 * second hand-written list of block types — that duplication is what caused BUG-01.
 *
 * ⚠️ Lives here rather than in the script so the admin button and the CLI run the same code. */

/** How much of the page a slot occupies, roughly — used to decide which few to fill when the caller
 * only wants a taste. Lower runs first.
 *
 * ⚠️ The logo is first and it is not a matter of taste: it sits in the header of EVERY page, so a
 * placeholder there is the one broken image a reviewer cannot avoid seeing. */
const SLOT_PRIORITY: { test: (slot: ImageSlot, doc: SiteDocument) => boolean; rank: number }[] = [
  { test: (slot) => slot.slot === LOGO_SLOT, rank: 0 },
  { test: (slot, doc) => doc.blocks.some((b) => b.type === "hero" && slot.slot === b.id), rank: 1 },
  // A section's own photograph — the big one beside the heading.
  { test: (slot) => !slot.field.includes("."), rank: 2 },
  { test: (slot) => slot.field.startsWith("images."), rank: 3 },
  { test: (slot) => slot.field.startsWith("members."), rank: 4 },
];

function priority(slot: ImageSlot, doc: SiteDocument): number {
  return SLOT_PRIORITY.find((entry) => entry.test(slot, doc))?.rank ?? 5;
}

/** Sample-clinic subject matter per placement. Keyed on the slot name's prefix, which is the block
 * id — the same key `applyImagePaths` writes back on. */
function subjectFor(slot: string, index: number): string {
  if (slot === LOGO_SLOT) {
    return (
      "A simple, flat, symbolic mark for a small Japanese clinic — a single abstract shape suggesting " +
      "care or growth, one colour, thick even strokes, generous margins, centred, on a fully " +
      "transparent background. No letters, no words, no initials."
    );
  }
  if (slot === "hero" || slot.startsWith("hero")) {
    return "A wide, calm view into a small private clinic just after opening: pale walls, a light oak reception counter, a tall window with sheer curtains, one plant. Nobody in the frame.";
  }
  if (slot.startsWith("staff")) {
    return (
      "A relaxed head-and-shoulders portrait of a Japanese healthcare professional in a clean white coat, " +
      "standing against a plain pale wall, soft even light, a natural unforced expression. " +
      `Make this person clearly different from the other portraits on the same page (variation ${index + 1}).`
    );
  }
  if (slot.startsWith("gallery")) {
    return (
      "A quiet interior detail of a small clinic — a corridor, a corner of a waiting area, or a treatment " +
      `room seen from the doorway. Nobody in the frame. Variation ${index + 1}: a different room and a ` +
      "different angle from the other interior photographs on this page."
    );
  }
  // ⚠️ 背景写真は「絵」ではなく「地」。主題があると本文と喧嘩するので、焦点も対象も持たせない。
  // CSS 側で --bg のスクリムが 88% 重なることも織り込んで、明るく淡いものを指示する。
  if (slot === "backdrop") {
    return (
      "An extremely soft, almost abstract background texture for a web page: out-of-focus daylight on a " +
      "pale plaster wall, with the faintest suggestion of a leaf shadow. No subject, no focal point, no " +
      "objects, no people. Very low contrast, very bright, nothing that competes with text placed over it."
    );
  }
  if (slot.startsWith("greeting")) {
    return "A consultation desk by a window in a small clinic: a closed notebook, a stethoscope resting on the wood, a small plant. Nobody in the frame.";
  }
  return "A quiet, uncluttered corner of a small Japanese clinic in daylight. Nobody in the frame.";
}

/** House style for every sample photograph, so a template preview reads as one clinic rather than a
 * collection of unrelated pictures. */
const HOUSE_STYLE =
  "Editorial photography for a Japanese medical clinic website. Bright natural daylight, calm, " +
  "uncluttered, warm neutral palette of off-white, pale oak and muted green. Shallow depth of field. " +
  "No text, no lettering, no signage, no logo, no watermark. Not clinical-cold, not stock-photo staged.";

/** `generateSiteImage` writes its prompt around a real clinic's hearing sheet. A template has no
 * clinic, so it gets a deliberately generic one — which is also what keeps a template preview looking
 * like a sample rather than like somebody's actual practice. */
function sampleHearing(doc: SiteDocument): HearingSheet {
  // Written out in full rather than cast, so that adding a required field to HearingSheet is a
  // compile error here instead of an undefined reaching the prompt builder at runtime.
  return {
    slug: doc.slug,
    clinicName: doc.meta.clinicName || "サンプルクリニック",
    address: doc.meta.address,
    phone: doc.meta.phone,
    line: doc.meta.line,
    department: "一般診療",
    hours: "",
    features: "",
    request: HOUSE_STYLE,
    createdAt: doc.createdAt,
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export type IllustratePlanItem = {
  slot: ImageSlot;
  /** Site-relative path the block will point at, e.g. `images/hero.jpg`. */
  relative: string;
  onDisk: boolean;
};

/** What `illustrate` would do, in the order it would do it. Exported so both the CLI's `--dry-run`
 * and the admin button's "残り N 枚" label read the same list.
 *
 * ⚠️ `onDisk` has to be resolved before anything is counted. `needsGeneratedFile` only says "this
 * path points inside our own images/ directory", which is equally true of a real photograph and of
 * the placeholder — so the slot list alone would quote a price for pictures that already exist. */
export async function planIllustration(doc: SiteDocument): Promise<IllustratePlanItem[]> {
  const { outDir } = siteOutputPath(doc);
  const targets = documentImageSlots(doc)
    .filter((slot) => slot.rendered && needsGeneratedFile(slot.value))
    .sort((a, b) => priority(a, doc) - priority(b, doc));

  return Promise.all(
    targets.map(async (slot) => {
      const relative = `images/${slot.slot}.${slot.slot === LOGO_SLOT ? "png" : "jpg"}`;
      return { slot, relative, onDisk: await exists(path.join(outDir, relative)) };
    })
  );
}

/** How many pictures this document is still missing. */
export async function remainingImageCount(doc: SiteDocument): Promise<number> {
  return (await planIllustration(doc)).filter((item) => !item.onDisk).length;
}

export type IllustrateResult = { made: number; skipped: number; failed: number; remaining: number };

/** ⚠️ Process-local, and that is enough: this app already assumes a long-lived Node server (see the
 * fire-and-forget `void runGeneration(slug)` in contentActions.ts). It stops a double-click from
 * being billed twice. A restart clears it, but `illustrate` skips files already on disk, so the
 * worst case after a restart is one wasted re-render, not a second bill. */
const running = new Set<string>();

export function isIllustrating(documentId: string): boolean {
  return running.has(documentId);
}

/**
 * @param limit Fill only the most valuable N slots. Omit for all of them.
 */
export async function illustrateTemplate(
  doc: SiteDocument,
  options: { limit?: number; force?: boolean } = {}
): Promise<IllustrateResult> {
  if (running.has(doc.id)) {
    return { made: 0, skipped: 0, failed: 0, remaining: await remainingImageCount(doc) };
  }
  running.add(doc.id);

  try {
    const { outDir } = siteOutputPath(doc);
    const plan = await planIllustration(doc);
    const todo = plan.filter((item) => options.force || !item.onDisk).slice(0, options.limit ?? plan.length);
    if (todo.length === 0) return { made: 0, skipped: plan.length, failed: 0, remaining: 0 };

    await mkdir(path.join(outDir, "images"), { recursive: true });
    const hearing = sampleHearing(doc);
    const paths = new Map<string, string>();
    let made = 0;
    let failed = 0;

    // Slots that keep what they already have. Written back unchanged so applyImagePaths does not
    // clear them for having produced no file this run.
    for (const item of plan) {
      if (!todo.includes(item) && item.onDisk) paths.set(item.slot.slot, item.relative);
    }

    for (const [index, item] of todo.entries()) {
      try {
        const buffer = await generateSiteImage(hearing, {
          label: item.slot.label,
          variationHint: `${index + 1}/${todo.length}`,
          customPrompt: `${subjectFor(item.slot.slot, index)} ${HOUSE_STYLE}`,
          // ⚠️ "logo" is what routes this to gpt-image-1 with a transparent background.
          // gpt-image-2 REJECTS `background: "transparent"` outright, so a logo generated as a
          // plain photo comes back as an opaque rectangle sitting in the header.
          style: item.slot.slot === LOGO_SLOT ? "logo" : "photo",
          targetSize: TARGET_SIZE[item.slot.aspect],
        });
        await writeFile(path.join(outDir, item.relative), buffer);
        paths.set(item.slot.slot, item.relative);
        made++;
      } catch (err) {
        failed++;
        console.error(`[illustrateTemplate] ${item.slot.slot}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ⚠️ applyImagePaths clears any slot that still points inside this directory but produced no
    // file — that is the point (a section with no photo beats one with a broken image), and it is
    // what keeps the stored document honest about what is actually on disk.
    applyImagePaths(doc, paths);
    const saved = await saveDocument(doc);
    await renderSiteFiles(saved);

    return { made, skipped: plan.length - todo.length, failed, remaining: await remainingImageCount(saved) };
  } finally {
    running.delete(doc.id);
  }
}

/** Matches the generation pipeline's ASPECT_SIZE, so a template's photographs come out the same
 * shape as the ones a real clinic's site gets. */
const TARGET_SIZE: Record<ImageSlot["aspect"], { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1200, height: 900 },
  "16:9": { width: 1200, height: 675 },
  "2:1": { width: 1200, height: 600 },
};
