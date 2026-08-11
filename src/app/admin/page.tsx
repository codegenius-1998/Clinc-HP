import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loginAdminAction } from "@/lib/authActions";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }

  return (
    <AuthForm
      action={loginAdminAction}
      eyebrow="ADMIN"
      title="管理者ログイン"
      submitLabel="ログイン"
      accent="slate"
    />
  );
}
