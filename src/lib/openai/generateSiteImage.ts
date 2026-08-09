import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";

export type ImageDescriptor = { label: string; variationHint?: string };

function buildPrompt(hearing: HearingSheet, image: ImageDescriptor): string {
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

/** Generates one JPEG image (as a Buffer) for a single image placement on the page. */
export async function generateSiteImage(hearing: HearingSheet, image: ImageDescriptor): Promise<Buffer> {
  const openai = getOpenAIClient();
  const result = await openai.images.generate({
    model: "gpt-image-2",
    prompt: buildPrompt(hearing, image),
    size: "1024x1024",
    quality: "medium",
    output_format: "jpeg",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`画像の生成に失敗しました（${image.label}）。`);
  }

  return Buffer.from(b64, "base64");
}
