"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listTemplates } from "./templates";
import { generateSlug, getHearing, saveHearing, updateHearing, type HearingSheet } from "./hearing";
import { generateSite } from "./siteGenerator";
import { deployGeneratedSiteToCloudflare } from "./cloudflareDeploy";
import { IMAGE_CATEGORIES } from "./imageCategories";

export type HearingFormState = {
  error: string | null;
};

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function generationErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "サイトの生成に失敗しました。";
}

export async function createHearingAction(
  _prevState: HearingFormState,
  formData: FormData
): Promise<HearingFormState> {
  const clinicName = requiredField(formData, "clinicName");
  const templateId = requiredField(formData, "templateId");
  const colorScheme = requiredField(formData, "colorScheme");

  if (!clinicName) {
    return { error: "クリニック名を入力してください。" };
  }
  if (!templateId || !colorScheme) {
    return { error: "テンプレートとカラーを選択してください。" };
  }

  const templates = await listTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return { error: "選択されたテンプレートが見つかりません。" };
  }
  const colorSchemeOption = template.colorSchemes.find((c) => c.id === colorScheme);
  const slug = generateSlug(clinicName);

  // Photos are uploaded to Supabase Storage client-side before this action runs (Server Actions
  // cap request bodies at 1MB, far too small for real photos) — only their URLs arrive here.
  const uploadedImages: NonNullable<HearingSheet["uploadedImages"]> = {};
  for (const category of IMAGE_CATEGORIES) {
    const urls = formData.getAll(`imageUrls_${category.key}`).filter((v): v is string => typeof v === "string" && v.length > 0);
    if (urls.length > 0) {
      uploadedImages[category.key] = urls;
    }
  }

  const hearing = await saveHearing({
    slug,
    templateId: template.id,
    templateLabel: template.label,
    colorScheme,
    colorSchemeLabel: colorSchemeOption?.label ?? colorScheme,
    clinicName,
    directorName: requiredField(formData, "directorName"),
    address: requiredField(formData, "address"),
    phone: requiredField(formData, "phone"),
    line: requiredField(formData, "line"),
    hours: requiredField(formData, "hours"),
    features: requiredField(formData, "features"),
    request: requiredField(formData, "request"),
    uploadedImages,
  });

  try {
    const result = await generateSite(hearing);
    await updateHearing(hearing.slug, { previewUrl: result.previewUrl, generationError: undefined });
  } catch (err) {
    await updateHearing(hearing.slug, { generationError: generationErrorMessage(err) });
  }

  redirect(`/sites/${hearing.slug}`);
}

export async function regenerateSiteAction(slug: string): Promise<void> {
  const hearing = await getHearing(slug);
  if (!hearing) {
    return;
  }

  try {
    const result = await generateSite(hearing);
    await updateHearing(slug, { previewUrl: result.previewUrl, generationError: undefined });
  } catch (err) {
    await updateHearing(slug, { generationError: generationErrorMessage(err) });
  }

  revalidatePath(`/sites/${slug}`);
}

export async function deployToCloudflareAction(slug: string): Promise<void> {
  const hearing = await getHearing(slug);
  if (!hearing?.previewUrl) {
    return;
  }

  try {
    const result = await deployGeneratedSiteToCloudflare(slug);
    await updateHearing(slug, { cloudflareUrl: result.url, cloudflareError: undefined });
  } catch (err) {
    await updateHearing(slug, {
      cloudflareError: err instanceof Error ? err.message : "Cloudflareへのデプロイに失敗しました。",
    });
  }

  revalidatePath(`/sites/${slug}`);
}
