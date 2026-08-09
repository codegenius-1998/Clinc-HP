import { cp, mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { getTemplateDefinition, TEMPLATES_DIR, type TemplateContentSlot, type TemplateImageSlot } from "./templates";
import { resolveUploadedImagePath, type HearingSheet } from "./hearing";
import { generateSiteCopy } from "./openai/generateSiteCopy";
import { generateSiteImage } from "./openai/generateSiteImage";

const EXCLUDED_FILES = new Set([".DS_Store", "AI_GUIDE.md", "_removed_images_manifest.md"]);

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");

export type GeneratedSite = {
  slug: string;
  previewUrl: string;
};

/** Slot ids whose value must come directly from the hearing sheet, never invented by AI. */
const DIRECT_SLOT_SOURCES: Record<string, (hearing: HearingSheet) => string | undefined> = {
  phone: (hearing) => hearing.phone || undefined,
};

function splitSlots(hearing: HearingSheet, slots: TemplateContentSlot[]) {
  const direct: { slot: TemplateContentSlot; value: string }[] = [];
  const aiSlots: TemplateContentSlot[] = [];

  for (const slot of slots) {
    const directSource = DIRECT_SLOT_SOURCES[slot.id];
    if (directSource) {
      const value = directSource(hearing);
      if (value) {
        direct.push({ slot, value });
      }
      continue;
    }
    aiSlots.push(slot);
  }

  return { direct, aiSlots };
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

  const { direct, aiSlots } = splitSlots(hearing, template.contentSlots);

  const uploadedImages = hearing.uploadedImages ?? {};
  const aiImageSlots = template.imageSlots.filter((slot) => !uploadedImages[slot.id]);
  const uploadedImageSlots = template.imageSlots.filter((slot) => uploadedImages[slot.id]);

  const [copyMap, aiImages, uploadedImageFiles] = await Promise.all([
    generateSiteCopy(hearing, aiSlots),
    Promise.all(
      aiImageSlots.map(async (slot) => ({
        slot,
        buffer: await generateSiteImage(hearing, slot),
      }))
    ),
    Promise.all(
      uploadedImageSlots.map(async (slot) => ({
        slot,
        buffer: await readFile(resolveUploadedImagePath(hearing.slug, uploadedImages[slot.id])),
      }))
    ),
  ]);

  const images: { slot: TemplateImageSlot; buffer: Buffer }[] = [...aiImages, ...uploadedImageFiles];

  const htmlPath = path.join(outDir, template.htmlFile);
  const html = await readFile(htmlPath, "utf-8");
  const $ = cheerio.load(html);

  $("html").attr("data-theme", hearing.colorScheme);

  for (const { slot, value } of direct) {
    $(slot.selector).first().text(value);
  }
  for (const slot of aiSlots) {
    const value = copyMap[slot.id];
    if (value) {
      $(slot.selector).first().text(value);
    }
  }

  await writeFile(htmlPath, $.html(), "utf-8");

  for (const { slot, buffer } of images) {
    const imagePath = path.join(outDir, slot.path);
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
