import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { ImageStyle } from "./planGeneration";

export type ImageDescriptor = {
  label: string;
  variationHint?: string;
  /** When set (from the generation plan), used verbatim instead of the generic photo prompt below —
   * lets logo/icon/photo placements each get a style-appropriate prompt. */
  customPrompt?: string;
  /** From the generation plan — drives output format/transparency (logo needs a transparent PNG). */
  style?: ImageStyle;
  /** The placement's real on-page pixel dimensions (from the template's imageSlots) — used to request
   * a matching aspect ratio from the model instead of always generating a square. */
  targetSize?: { width: number; height: number };
};

/** `gpt-image-2` supports arbitrary WIDTHxHEIGHT resolutions (good for matching a placement's real
 * aspect ratio) but explicitly does NOT support `background: "transparent"` — the API rejects that
 * combination outright. `gpt-image-1` supports transparency but only the 3 fixed legacy sizes
 * (1024x1024 / 1536x1024 / 1024x1536). A logo needs the transparency far more than it needs an exact
 * aspect ratio, so logo/icon placements are routed to gpt-image-1; everything else stays on
 * gpt-image-2 for the closer aspect-ratio match. */
const TRANSPARENT_MODEL = "gpt-image-1";
const SIZED_MODEL = "gpt-image-2";

const MIN_ASPECT_RATIO = 1 / 3;
const MAX_ASPECT_RATIO = 3;
/** gpt-image-2 rejects requests below its minimum total-pixel budget ("400 Invalid size ... below the
 * current minimum pixel budget") even when the long edge looks reasonable — a fixed long-edge budget
 * (e.g. 1280) starves the short edge on wide/narrow aspect ratios (1280x432 = ~553K px, well under the
 * 1024x1024 = ~1.05M px floor that's known to work). Sizing off total area instead of a fixed edge
 * guarantees every aspect ratio clears that floor. */
const MIN_TOTAL_PIXELS = 1024 * 1024;
const FALLBACK_SIZE = "1024x1024";

function roundToMultipleOf16(value: number): number {
  return Math.max(16, Math.round(value / 16) * 16);
}

/** Picks the `WIDTHxHEIGHT` string to request from gpt-image-2, which (unlike the fixed 1024x1024 /
 * 1536x1024 / 1024x1536 presets on older models) accepts arbitrary resolutions as long as both edges
 * are divisible by 16, the aspect ratio is within 1:3-3:1, and the total pixel count clears the
 * model's minimum budget. A placement's declared aspect ratio more extreme than 1:3-3:1 (e.g. a
 * 1100x120 ultra-wide logo, ~9:1) gets clamped to the nearest edge of that range — still far closer to
 * the real shape than a plain square. */
export function resolveGenerationSize(targetSize?: { width: number; height: number }): string {
  if (!targetSize || targetSize.width <= 0 || targetSize.height <= 0) {
    return FALLBACK_SIZE;
  }
  const aspect = Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, targetSize.width / targetSize.height));
  // width * height = MIN_TOTAL_PIXELS and width / height = aspect, solved for height.
  const rawHeight = Math.sqrt(MIN_TOTAL_PIXELS / aspect);
  const rawWidth = rawHeight * aspect;

  let width = roundToMultipleOf16(rawWidth);
  let height = roundToMultipleOf16(rawHeight);
  // Rounding down on either edge can nudge the total back under the floor — nudge back up rather than
  // risk another "below minimum pixel budget" rejection.
  while (width * height < MIN_TOTAL_PIXELS) {
    if (aspect >= 1) {
      width += 16;
    } else {
      height += 16;
    }
  }

  return `${width}x${height}`;
}

/** Picks the closest of gpt-image-1's 3 fixed sizes to the placement's real aspect ratio. */
export function resolveFixedPresetSize(targetSize?: { width: number; height: number }): string {
  if (!targetSize || targetSize.width <= 0 || targetSize.height <= 0) {
    return FALLBACK_SIZE;
  }
  const aspect = targetSize.width / targetSize.height;
  if (aspect >= 1.2) return "1536x1024";
  if (aspect <= 1 / 1.2) return "1024x1536";
  return FALLBACK_SIZE;
}

/** Hard-coded reinforcement appended to every "logo" prompt, regardless of what the planning AI wrote
 * (`customPrompt` is model-authored and can't be fully trusted to remember this on its own) — the
 * `background: "transparent"` API param alone doesn't stop the model from drawing an opaque shape
 * (a colored circle, badge, or card) behind the mark, which still reads as "wrong background" once
 * placed on the actual page. */
const LOGO_BACKGROUND_INSTRUCTION =
  "The image canvas background must be fully transparent (alpha channel, not white, not any color) — do not draw any background at all: no colored fill, no gradient, no circle, no badge, no card, no rounded rectangle, no frame, no shadow plate behind the mark. Only the isolated logo mark itself on pure transparency, cropped tight with no surrounding canvas padding. Do not render any text, letters, clinic name, or words in the image.";

function buildLogoPrompt(hearing: HearingSheet): string {
  const motifHints = [
    hearing.department && `Clinic specialty: ${hearing.department}`,
    hearing.features && `Clinic features: ${hearing.features}`,
    hearing.request && `Owner request: ${hearing.request}`,
  ]
    .filter(Boolean)
    .join(". ");

  return [
    "Create a unique square medical clinic brand mark for a Japanese clinic website header.",
    `This mark represents the clinic named "${hearing.clinicName}" — use that identity only as creative direction, do NOT draw the name or any readable text in the image.`,
    "Size intent: about 128x128, square 1:1 composition, flat or semi-flat vector-like medical symbol.",
    "Pick one distinctive medical motif informed by the clinic (examples: stethoscope, heart, medical cross, leaf, shield, pulse wave, caring hands) — avoid repeating the same pastel five-square cross every time.",
    motifHints || "Choose a clean, trustworthy medical motif appropriate for a general clinic.",
    "Colors may vary with the clinic mood; do not lock to a fixed pastel palette.",
    LOGO_BACKGROUND_INSTRUCTION,
  ].join(" ");
}

function buildPrompt(hearing: HearingSheet, image: ImageDescriptor): string {
  if (image.style === "logo") {
    // Logo prompts are authored here so every site gets clinic-specific medical marks at ~128x128,
    // instead of reusing a near-identical generic cross from the planning model.
    return image.customPrompt
      ? `${image.customPrompt} ${LOGO_BACKGROUND_INSTRUCTION}`
      : buildLogoPrompt(hearing);
  }

  if (image.customPrompt) {
    return image.customPrompt;
  }

  const details = [
    `Clinic name (do not render as text in the image): ${hearing.clinicName}`,
    hearing.features && `Notable features: ${hearing.features}`,
  ]
    .filter(Boolean)
    .join(". ");

  return [
    `A photorealistic image for a Japanese medical clinic website, for "${image.label}".`,
    details,
    "Style: bright, clean, professional editorial photography, natural light, shallow depth of field.",
    "No text, no watermark, no logo overlay, no readable signage.",
    image.variationHint &&
      `This is image ${image.variationHint} used on the same page — make it visually distinct from the other images on this page (different angle, framing, or moment), never a near-duplicate.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function requestImage(
  hearing: HearingSheet,
  image: ImageDescriptor,
  model: string,
  size: string,
  outputFormat: "png" | "jpeg",
  needsTransparency: boolean
) {
  const openai = getOpenAIClient();
  return openai.images.generate({
    model,
    prompt: buildPrompt(hearing, image),
    size,
    quality: "medium",
    output_format: outputFormat,
    ...(needsTransparency ? { background: "transparent" } : {}),
    n: 1,
  });
}

/** Generates one image (as a Buffer) for a single image placement on the page. Logo placements need a
 * transparent PNG, which only gpt-image-1 supports — gpt-image-2 rejects `background: "transparent"`
 * outright — so those are routed to gpt-image-1 at the nearest fixed preset size. Everything else uses
 * gpt-image-2, which trades transparency support for arbitrary aspect-ratio sizing (see
 * `resolveGenerationSize`). If the model still rejects the requested size (an "Invalid size" 400 — the
 * exact minimum-pixel-budget rule for gpt-image-2 isn't publicly documented, so our computed floor
 * could still be wrong in an edge case), retry once with the known-good 1024x1024 square on the same
 * model rather than failing the whole generation. */
export async function generateSiteImage(hearing: HearingSheet, image: ImageDescriptor): Promise<Buffer> {
  const needsTransparency = image.style === "logo";
  const outputFormat = needsTransparency ? "png" : "jpeg";
  const model = needsTransparency ? TRANSPARENT_MODEL : SIZED_MODEL;
  const size = needsTransparency ? resolveFixedPresetSize(image.targetSize) : resolveGenerationSize(image.targetSize);

  let result;
  try {
    result = await requestImage(hearing, image, model, size, outputFormat, needsTransparency);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isInvalidSize = message.includes("Invalid size") || message.includes("pixel budget");
    if (!isInvalidSize || size === FALLBACK_SIZE) {
      throw err;
    }
    result = await requestImage(hearing, image, model, FALLBACK_SIZE, outputFormat, needsTransparency);
  }

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`画像の生成に失敗しました（${image.label}）。`);
  }

  return Buffer.from(b64, "base64");
}
