"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "./auth";
import { generateSlug, getHearing, saveHearing, deleteHearing, type HearingSheet } from "./hearing";
import { listDepartments, listServices, listFeatures, listTargets } from "./content";
import { IMAGE_CATEGORIES } from "./imageCategories";

export type ApplicationFormState = {
  error: string | null;
};

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Submits a new site-build application from /mypage/apply. Unlike the /create flow, this never
 * triggers generation directly: an admin approves the request from /admin/requests (see
 * approveRequestAction in contentActions.ts), and that is what kicks off generateSite — including
 * the automatic template choice. */
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

  if (!clinicName) {
    return { error: "クリニック名を入力してください。" };
  }

  const uploadedImages: NonNullable<HearingSheet["uploadedImages"]> = {};
  for (const category of IMAGE_CATEGORIES) {
    const urls = formData
      .getAll(`imageUrls_${category.key}`)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (urls.length > 0) {
      uploadedImages[category.key] = urls;
    }
  }

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
    directorName: "",
    address,
    phone,
    line,
    // Legacy free-text fields the AI content-plan prompt reads directly — derived from the
    // structured selections above so generateContentPlan needs no changes.
    department: selectedDepartmentNames.join("・"),
    hours: "",
    features: featureNames.join("、"),
    request: "",
    serviceNames,
    featureNames,
    targetNames,
    uploadedImages,
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
