"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  if (!clinicName) {
    return { error: "クリニック名を入力してください。" };
  }
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

  const staffNames = formData.getAll("staffName").map((v) => (typeof v === "string" ? v.trim() : ""));
  const staffComments = formData.getAll("staffComment").map((v) => (typeof v === "string" ? v.trim() : ""));
  const staffRoles = formData.getAll("staffRole").map((v) => (typeof v === "string" ? v.trim() : ""));
  const staffPhotoUrls = formData.getAll("staffPhotoUrl").map((v) => (typeof v === "string" ? v.trim() : ""));
  const staffMembers = staffNames
    .map((name, i) => ({
      name,
      comment: staffComments[i] ?? "",
      role: staffRoles[i] ?? "",
      photoUrl: staffPhotoUrls[i] || undefined,
    }))
    .filter((member) => member.name.length > 0);

  const faqQuestions = formData.getAll("faqQuestion").map((v) => (typeof v === "string" ? v.trim() : ""));
  const faqAnswers = formData.getAll("faqAnswer").map((v) => (typeof v === "string" ? v.trim() : ""));
  const faqs = faqQuestions
    .map((question, i) => ({ question, answer: faqAnswers[i] ?? "" }))
    .filter((faq) => faq.question.length > 0 && faq.answer.length > 0);

  const newsDates = formData.getAll("newsDate").map((v) => (typeof v === "string" ? v.trim() : ""));
  const newsTitles = formData.getAll("newsTitle").map((v) => (typeof v === "string" ? v.trim() : ""));
  const news = newsTitles
    .map((title, i) => ({ date: newsDates[i] ?? "", title }))
    .filter((item) => item.title.length > 0);

  const priceNames = formData.getAll("priceName").map((v) => (typeof v === "string" ? v.trim() : ""));
  const pricePrices = formData.getAll("pricePrice").map((v) => (typeof v === "string" ? v.trim() : ""));
  const priceNotes = formData.getAll("priceNote").map((v) => (typeof v === "string" ? v.trim() : ""));
  const priceItems = priceNames
    .map((name, i) => ({ name, price: pricePrices[i] ?? "", note: priceNotes[i] || undefined }))
    .filter((item) => item.name.length > 0 && item.price.length > 0);

  const hearing = await saveHearing({
    slug,
    clinicName,
    directorName: requiredField(formData, "directorName"),
    address: requiredField(formData, "address"),
    phone: requiredField(formData, "phone"),
    line: requiredField(formData, "line"),
    department: requiredField(formData, "department"),
    hours: requiredField(formData, "hours"),
    features: requiredField(formData, "features"),
    request: requiredField(formData, "request"),
    uploadedImages,
    staffMembers: staffMembers.length > 0 ? staffMembers : undefined,
    faqs: faqs.length > 0 ? faqs : undefined,
    news: news.length > 0 ? news : undefined,
    priceItems: priceItems.length > 0 ? priceItems : undefined,
  });

  try {
    const result = await generateSite(hearing);
    await updateHearing(hearing.slug, {
      previewUrl: result.previewUrl,
      generationError: undefined,
      templateId: result.templateId,
      templateLabel: result.templateName,
      templateReason: result.templateReason ?? undefined,
    });
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
    await updateHearing(slug, {
      previewUrl: result.previewUrl,
      generationError: undefined,
      templateId: result.templateId,
      templateLabel: result.templateName,
      templateReason: result.templateReason ?? undefined,
    });
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
