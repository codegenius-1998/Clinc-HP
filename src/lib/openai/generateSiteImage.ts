import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { TemplateImageSlot } from "@/lib/templates";

function buildPrompt(hearing: HearingSheet, slot: TemplateImageSlot): string {
  const details = [
    `Clinic name (do not render as text in the image): ${hearing.clinicName}`,
    hearing.features && `Notable features: ${hearing.features}`,
  ]
    .filter(Boolean)
    .join(". ");

  return [
    `A photorealistic image for a Japanese medical clinic website, for the "${slot.label}" section.`,
    details,
    "Style: bright, clean, professional editorial photography, natural light, shallow depth of field.",
    "No text, no watermark, no logo overlay, no readable signage.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Generates one JPEG image (as a Buffer) for a template image slot. */
export async function generateSiteImage(hearing: HearingSheet, slot: TemplateImageSlot): Promise<Buffer> {
  const openai = getOpenAIClient();
  const result = await openai.images.generate({
    model: "gpt-image-2",
    prompt: buildPrompt(hearing, slot),
    size: "1024x1024",
    quality: "medium",
    output_format: "jpeg",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`画像の生成に失敗しました（${slot.label}）。`);
  }

  return Buffer.from(b64, "base64");
}
