"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getSession, createUser, deleteUser } from "./auth";
import { deleteHearing, getHearing, saveHearing, type HearingSheet } from "./hearing";
import {
  buildSiteFromHearing,
  writeBundle,
  regenerateSectionText,
  generateOneImage,
} from "./buildSiteFromHearing";
import { normalizeTemplate } from "./generatedSite/normalize";
import type { SiteTemplate } from "./generatedSite/types";
import {
  createDepartmentWithServices,
  updateDepartment,
  deleteDepartment,
  createService,
  updateService,
  deleteService,
  createFeature,
  updateFeature,
  deleteFeature,
  createTarget,
  updateTarget,
  deleteTarget,
  createSection,
  updateSection,
  deleteSection,
} from "./content";

export type ActionState = { error: string | null };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// --- Users ---

export async function createUserAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = field(formData, "email");
  const password = field(formData, "password");
  const role = field(formData, "role");
  if (!email || !password || (role !== "admin" && role !== "clinic_owner")) {
    return { error: "メールアドレス・パスワード・ロールを正しく入力してください。" };
  }
  try {
    await createUser(email, password, role);
  } catch (err) {
    return { error: errorMessage(err, "ユーザーの作成に失敗しました。") };
  }
  revalidatePath("/admin/users");
  return { error: null };
}

export async function deleteUserAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteUser(id);
  revalidatePath("/admin/users");
}

// --- Requests (application sheets) ---

export async function deleteRequestAction(slug: string): Promise<void> {
  await requireAdmin();
  await deleteHearing(slug);
  revalidatePath("/admin/requests");
}

export type GenerateSiteResult =
  | { ok: true; url: string; imagesGenerated: number; imagesFromUploads: number; warnings: string[] }
  | { ok: false; error: string };

/** Builds a static clinic site from a submitted hearing sheet using OpenAI (copy + photos) and
 * writes it to public/_generated/<slug>/. Synchronous and slow (tens of seconds). Admin only. */
export async function generateSiteAction(slug: string): Promise<GenerateSiteResult> {
  await requireAdmin();
  const hearing = await getHearing(slug);
  if (!hearing) return { ok: false, error: "リクエストが見つかりません。" };

  try {
    const result = await buildSiteFromHearing(hearing);
    await saveHearing({
      ...hearing,
      generatedSite: {
        at: new Date().toISOString(),
        imagesGenerated: result.imagesGenerated,
        imagesFromUploads: result.imagesFromUploads,
        template: result.template,
      },
    });
    revalidatePath("/admin/requests");
    return {
      ok: true,
      url: result.url,
      imagesGenerated: result.imagesGenerated,
      imagesFromUploads: result.imagesFromUploads,
      warnings: result.warnings,
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "サイト生成に失敗しました。") };
  }
}

// --- Generated-site editor (admin OR the owning clinic_owner) ---

/** The admin and the clinic_owner who submitted the sheet may both edit its generated site.
 * Server Actions are directly POST-able, so this guard runs at the top of every editor action —
 * a page-level check is not enough (see src/lib/auth.ts). */
async function requireSiteEditAccess(slug: string): Promise<HearingSheet> {
  const session = await getSession();
  if (!session) throw new Error("ログインが必要です。");
  const hearing = await getHearing(slug);
  if (!hearing) throw new Error("リクエストが見つかりません。");
  if (session.role === "admin") return hearing;
  if (session.role === "clinic_owner" && hearing.ownerEmail === session.email) return hearing;
  throw new Error("権限がありません。");
}

export type SaveTemplateResult = { ok: true; url: string } | { ok: false; error: string };

/** Re-renders the static bundle from an edited template and persists it. No OpenAI. */
export async function saveGeneratedTemplateAction(
  slug: string,
  template: SiteTemplate
): Promise<SaveTemplateResult> {
  try {
    const hearing = await requireSiteEditAccess(slug);
    const normalized = normalizeTemplate(template, {
      brandName: hearing.clinicName,
      department: hearing.department,
      hours: hearing.hours,
      trustLayout: true,
    });
    await writeBundle(slug, normalized);
    await saveHearing({
      ...hearing,
      generatedSite: {
        at: hearing.generatedSite?.at ?? new Date().toISOString(),
        editedAt: new Date().toISOString(),
        imagesGenerated: hearing.generatedSite?.imagesGenerated,
        imagesFromUploads: hearing.generatedSite?.imagesFromUploads,
        template: normalized,
      },
    });
    revalidatePath("/admin/requests");
    revalidatePath("/mypage/requests");
    return { ok: true, url: `/api/generated/${slug}/` };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "保存に失敗しました。") };
  }
}

export type RegenerateSectionResult =
  | { ok: true; template: SiteTemplate }
  | { ok: false; error: string };

/** Rewrites one section's copy via OpenAI. Returns the updated template; the editor decides when to
 * save. Admin or owning clinic_owner. */
export async function regenerateSectionAction(
  slug: string,
  sectionId: string,
  template: SiteTemplate
): Promise<RegenerateSectionResult> {
  try {
    const hearing = await requireSiteEditAccess(slug);
    const next = await regenerateSectionText(hearing, template, sectionId);
    return { ok: true, template: next };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "再生成に失敗しました。") };
  }
}

export type GenerateImageResult = { ok: true; url: string } | { ok: false; error: string };

/** Generates one photo via OpenAI and returns its stored URL. The editor patches the template and
 * saves separately. Admin or owning clinic_owner. */
export async function generateImageAction(
  slug: string,
  kind: "portrait" | "interior" | "exterior",
  hint: string
): Promise<GenerateImageResult> {
  try {
    await requireSiteEditAccess(slug);
    const url = await generateOneImage(slug, kind, hint || "院内の様子");
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "画像生成に失敗しました。") };
  }
}

// --- Departments & services ---

export async function createDepartmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = field(formData, "name");
  const serviceNames = formData
    .getAll("serviceName")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  if (!name) {
    return { error: "部門名を入力してください。" };
  }
  try {
    await createDepartmentWithServices(name, serviceNames);
  } catch (err) {
    return { error: errorMessage(err, "部門の作成に失敗しました。") };
  }
  revalidatePath("/admin/departments");
  return { error: null };
}

export async function updateDepartmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = field(formData, "id");
  const name = field(formData, "name");
  if (!id || !name) {
    return { error: "部門名を入力してください。" };
  }
  try {
    await updateDepartment(id, name);
  } catch (err) {
    return { error: errorMessage(err, "部門の更新に失敗しました。") };
  }
  revalidatePath("/admin/departments");
  revalidatePath(`/admin/departments/${id}`);
  return { error: null };
}

export async function deleteDepartmentAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteDepartment(id);
  revalidatePath("/admin/departments");
}

export async function createServiceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const departmentId = field(formData, "departmentId");
  const name = field(formData, "name");
  if (!departmentId || !name) {
    return { error: "部門とサービス名を入力してください。" };
  }
  try {
    await createService(departmentId, name);
  } catch (err) {
    return { error: errorMessage(err, "サービスの作成に失敗しました。") };
  }
  revalidatePath(`/admin/departments/${departmentId}`);
  return { error: null };
}

export async function updateServiceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = field(formData, "id");
  const departmentId = field(formData, "departmentId");
  const name = field(formData, "name");
  if (!id || !name) {
    return { error: "サービス名を入力してください。" };
  }
  try {
    await updateService(id, name);
  } catch (err) {
    return { error: errorMessage(err, "サービスの更新に失敗しました。") };
  }
  revalidatePath(`/admin/departments/${departmentId}`);
  return { error: null };
}

export async function deleteServiceAction(id: string, departmentId: string): Promise<void> {
  await requireAdmin();
  await deleteService(id);
  revalidatePath(`/admin/departments/${departmentId}`);
}

// --- Features & Targets (flat tag lookups) ---

export async function createFeatureAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = field(formData, "name");
  if (!name) {
    return { error: "特徴名を入力してください。" };
  }
  try {
    await createFeature(name);
  } catch (err) {
    return { error: errorMessage(err, "特徴の作成に失敗しました。") };
  }
  revalidatePath("/admin/features");
  return { error: null };
}

export async function updateFeatureAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = field(formData, "id");
  const name = field(formData, "name");
  if (!id || !name) {
    return { error: "特徴名を入力してください。" };
  }
  try {
    await updateFeature(id, name);
  } catch (err) {
    return { error: errorMessage(err, "特徴の更新に失敗しました。") };
  }
  revalidatePath("/admin/features");
  return { error: null };
}

export async function deleteFeatureAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteFeature(id);
  revalidatePath("/admin/features");
}

export async function createTargetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = field(formData, "name");
  if (!name) {
    return { error: "ターゲット名を入力してください。" };
  }
  try {
    await createTarget(name);
  } catch (err) {
    return { error: errorMessage(err, "ターゲットの作成に失敗しました。") };
  }
  revalidatePath("/admin/targets");
  return { error: null };
}

export async function updateTargetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = field(formData, "id");
  const name = field(formData, "name");
  if (!id || !name) {
    return { error: "ターゲット名を入力してください。" };
  }
  try {
    await updateTarget(id, name);
  } catch (err) {
    return { error: errorMessage(err, "ターゲットの更新に失敗しました。") };
  }
  revalidatePath("/admin/targets");
  return { error: null };
}

export async function deleteTargetAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteTarget(id);
  revalidatePath("/admin/targets");
}

// --- Sections (flat name-only master) ---

export async function createSectionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = field(formData, "name");
  if (!name) {
    return { error: "セクション名を入力してください。" };
  }
  try {
    await createSection(name);
  } catch (err) {
    return { error: errorMessage(err, "セクションの作成に失敗しました。") };
  }
  revalidatePath("/admin/sections");
  return { error: null };
}

export async function updateSectionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = field(formData, "id");
  const name = field(formData, "name");
  if (!id || !name) {
    return { error: "セクション名を入力してください。" };
  }
  try {
    await updateSection(id, name);
  } catch (err) {
    return { error: errorMessage(err, "セクションの更新に失敗しました。") };
  }
  revalidatePath("/admin/sections");
  return { error: null };
}

export async function deleteSectionAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteSection(id);
  revalidatePath("/admin/sections");
}
