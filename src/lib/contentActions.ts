"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, createUser, deleteUser } from "./auth";
import { deleteHearing } from "./hearing";
import {
  createSection,
  deleteSection,
  createSite,
  setSiteCanSell,
  deleteSite,
  addSiteSection,
  deleteSiteSection,
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
  deleteTarget,
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

// --- Requests (hearing sheets) ---

export async function deleteRequestAction(slug: string): Promise<void> {
  await requireAdmin();
  await deleteHearing(slug);
  revalidatePath("/admin/requests");
}

// --- Templates (sites + their sections) ---

export async function createSiteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = field(formData, "name");
  const canSell = field(formData, "canSell") === "on";
  if (!name) {
    return { error: "テンプレート名を入力してください。" };
  }
  try {
    await createSite(name, true, canSell);
  } catch (err) {
    return { error: errorMessage(err, "テンプレートの作成に失敗しました。") };
  }
  revalidatePath("/admin/templates");
  return { error: null };
}

export async function toggleSiteCanSellAction(id: string, canSell: boolean): Promise<void> {
  await requireAdmin();
  await setSiteCanSell(id, canSell);
  revalidatePath("/admin/templates");
}

export async function deleteSiteAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteSite(id);
  revalidatePath("/admin/templates");
}

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

export async function deleteSectionAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteSection(id);
  revalidatePath("/admin/sections");
}

export async function addSiteSectionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const siteId = field(formData, "siteId");
  const secId = field(formData, "secId");
  const content = field(formData, "content") || "{}";
  const position = Number(field(formData, "position") || "0");

  if (!siteId || !secId) {
    return { error: "セクションを選択してください。" };
  }
  try {
    JSON.parse(content);
  } catch {
    return { error: "contentは有効なJSONで入力してください。" };
  }
  try {
    await addSiteSection(siteId, secId, content, position);
  } catch (err) {
    return { error: errorMessage(err, "セクションの追加に失敗しました。") };
  }
  revalidatePath(`/admin/templates/${siteId}`);
  return { error: null };
}

export async function deleteSiteSectionAction(id: string, siteId: string): Promise<void> {
  await requireAdmin();
  await deleteSiteSection(id);
  revalidatePath(`/admin/templates/${siteId}`);
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

export async function deleteTargetAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteTarget(id);
  revalidatePath("/admin/targets");
}
