import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signupClinicOwnerAction } from "@/lib/authActions";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignupPage() {
  const session = await getSession();
  if (session?.role === "clinic_owner") {
    redirect("/home");
  }

  return (
    <AuthForm
      action={signupClinicOwnerAction}
      eyebrow="CLINIC HP BUILDER"
      title="新規登録"
      submitLabel="登録する"
      accent="sky"
      showConfirmPassword
      footer={{ href: "/", label: "既にアカウントをお持ちの方はこちら" }}
    />
  );
}
