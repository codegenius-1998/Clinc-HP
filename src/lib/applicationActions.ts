"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "./auth";
import {
  generateSlug,
  getHearing,
  saveHearing,
  deleteHearing,
  type HearingSheet,
  type ScheduleInput,
} from "./hearing";
import { listDepartments, listServices, listFeatures, listTargets } from "./content";
import { IMAGE_CATEGORIES } from "./imageCategories";

export type ApplicationFormState = {
  error: string | null;
};

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const DEFAULT_DAYS = ["月", "火", "水", "木", "金", "土", "日"];

/** Parses the JSON-encoded `schedule` field the apply form appends. Returns `undefined` when it is
 * missing / malformed / has no usable rows. */
function parseSchedule(raw: FormDataEntryValue | null): ScheduleInput | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const p = parsed as { days?: unknown; rows?: unknown; notes?: unknown };

  const days = Array.isArray(p.days) && p.days.every((d) => typeof d === "string" && d) ? (p.days as string[]) : DEFAULT_DAYS;
  const rows = (Array.isArray(p.rows) ? p.rows : [])
    .map((r) => {
      const rr = (typeof r === "object" && r !== null ? r : {}) as { label?: unknown; marks?: unknown };
      const label = typeof rr.label === "string" ? rr.label.trim() : "";
      const marks = Array.isArray(rr.marks)
        ? rr.marks.map((m) => (typeof m === "string" && m.trim() ? m.trim() : null))
        : [];
      return { label, marks };
    })
    .filter((r) => r.label.length > 0 || r.marks.some((m) => m && m !== "／"));
  if (rows.length === 0) return undefined;

  const notes = (Array.isArray(p.notes) ? p.notes : [])
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter(Boolean);

  return { days, rows, notes };
}

/** Submits a new site-build application from /mypage/apply — the only way an application sheet
 * enters the system. An admin reviews it from /admin/requests (view / delete only). */
export async function createApplicationAction(
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    return { error: "ログインが必要です。" };
  }

  const clinicName = requiredField(formData, "clinicName");
  const address = requiredField(formData, "address");
  const phone = requiredField(formData, "phone");
  const line = requiredField(formData, "line");
  const request = requiredField(formData, "request");

  if (!clinicName) {
    return { error: "クリニック名を入力してください。" };
  }

  const schedule = parseSchedule(formData.get("schedule"));

  const directorName = requiredField(formData, "directorName");
  const directorRole = requiredField(formData, "directorRole") || "院長";
  const directorGreeting = requiredField(formData, "directorGreeting");
  const directorPhotoUrl = formData
    .getAll("directorPhotoUrl")
    .find((v): v is string => typeof v === "string" && v.trim().length > 0)
    ?.trim();
  const director: HearingSheet["director"] =
    directorName || directorGreeting || directorPhotoUrl
      ? { name: directorName, role: directorRole, greeting: directorGreeting, photoUrl: directorPhotoUrl }
      : undefined;

  const priceNames = formData.getAll("priceName").map((v) => (typeof v === "string" ? v.trim() : ""));
  const pricePrices = formData.getAll("pricePrice").map((v) => (typeof v === "string" ? v.trim() : ""));
  const priceNotes = formData.getAll("priceNote").map((v) => (typeof v === "string" ? v.trim() : ""));
  const priceItems = priceNames
    .map((name, i) => ({ name, price: pricePrices[i] ?? "", note: priceNotes[i] || undefined }))
    .filter((item) => item.name.length > 0 && item.price.length > 0);

  const uploadedImages: NonNullable<HearingSheet["uploadedImages"]> = {};
  for (const category of IMAGE_CATEGORIES) {
    const urls = formData
      .getAll(`imageUrls_${category.key}`)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (urls.length > 0) {
      uploadedImages[category.key] = urls;
    }
  }

  const heroImageUrl = formData
    .getAll("imageUrls_hero")
    .find((v): v is string => typeof v === "string" && v.trim().length > 0)
    ?.trim();

  const faqQuestions = formData.getAll("faqQuestion").map((v) => (typeof v === "string" ? v.trim() : ""));
  const faqAnswers = formData.getAll("faqAnswer").map((v) => (typeof v === "string" ? v.trim() : ""));
  const faqs = faqQuestions
    .map((question, i) => ({ question, answer: faqAnswers[i] ?? "" }))
    .filter((f) => f.question.length > 0 && f.answer.length > 0);

  const newsDates = formData.getAll("newsDate").map((v) => (typeof v === "string" ? v.trim() : ""));
  const newsTitles = formData.getAll("newsTitle").map((v) => (typeof v === "string" ? v.trim() : ""));
  const news = newsTitles
    .map((title, i) => ({ date: newsDates[i] ?? "", title }))
    .filter((n) => n.title.length > 0);

  const selectedServiceIds = new Set(formData.getAll("serviceId").filter((v): v is string => typeof v === "string"));
  const selectedFeatureIds = new Set(formData.getAll("featureId").filter((v): v is string => typeof v === "string"));
  const selectedTargetIds = new Set(formData.getAll("targetId").filter((v): v is string => typeof v === "string"));

  const [departments, services, features, targets] = await Promise.all([
    listDepartments(),
    listServices(),
    listFeatures(),
    listTargets(),
  ]);

  const selectedServices = services.filter((s) => selectedServiceIds.has(s.id));
  const selectedDepartmentNames = [
    ...new Set(
      selectedServices
        .map((s) => departments.find((d) => d.id === s.department_id)?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];
  const serviceNames = selectedServices.map((s) => s.name);
  const featureNames = features.filter((f) => selectedFeatureIds.has(f.id)).map((f) => f.name);
  const targetNames = targets.filter((t) => selectedTargetIds.has(t.id)).map((t) => t.name);

  const slug = generateSlug(clinicName);

  await saveHearing({
    slug,
    ownerEmail: session.email,
    clinicName,
    address,
    phone,
    line,
    // Legacy free-text fields the AI content-plan prompt reads directly — derived from the
    // structured selections above so generateContentPlan needs no changes.
    department: selectedDepartmentNames.join("・"),
    schedule,
    director,
    features: featureNames.join("、"),
    request,
    serviceNames,
    featureNames,
    targetNames,
    uploadedImages,
    heroImageUrl,
    priceItems: priceItems.length > 0 ? priceItems : undefined,
    faqs: faqs.length > 0 ? faqs : undefined,
    news: news.length > 0 ? news : undefined,
  });

  revalidatePath("/mypage/requests");
  redirect("/mypage/requests");
}

/** Deletes an application, but only the submitting clinic_owner's own — /mypage must never let one
 * clinic delete another's request (unlike /admin's deleteRequestAction, which is admin-only and
 * unrestricted). */
export async function deleteOwnApplicationAction(slug: string): Promise<void> {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    throw new Error("権限がありません。");
  }
  const hearing = await getHearing(slug);
  if (!hearing || hearing.ownerEmail !== session.email) {
    throw new Error("権限がありません。");
  }
  await deleteHearing(slug);
  revalidatePath("/mypage/requests");
}
