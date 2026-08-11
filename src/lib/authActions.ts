"use server";

import { redirect } from "next/navigation";
import { createUser, login, logout } from "./auth";

export type AuthFormState = {
  error: string | null;
};

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function loginClinicOwnerAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = requiredField(formData, "email");
  const password = requiredField(formData, "password");
  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  try {
    await login(email, password, "clinic_owner");
  } catch (err) {
    return { error: errorMessage(err, "ログインに失敗しました。") };
  }

  redirect("/home");
}

export async function loginAdminAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = requiredField(formData, "email");
  const password = requiredField(formData, "password");
  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  try {
    await login(email, password, "admin");
  } catch (err) {
    return { error: errorMessage(err, "ログインに失敗しました。") };
  }

  redirect("/admin/dashboard");
}

export async function signupClinicOwnerAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = requiredField(formData, "email");
  const password = requiredField(formData, "password");
  const passwordConfirm = requiredField(formData, "passwordConfirm");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }
  if (password !== passwordConfirm) {
    return { error: "パスワードが一致しません。" };
  }

  try {
    await createUser(email, password, "clinic_owner");
    await login(email, password, "clinic_owner");
  } catch (err) {
    return { error: errorMessage(err, "登録に失敗しました。") };
  }

  redirect("/home");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/");
}
