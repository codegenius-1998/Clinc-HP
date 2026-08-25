import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loginClinicOwnerAction } from "@/lib/authActions";
import { AuthForm } from "@/components/auth/AuthForm";

/** The clinic owner's login. It used to live at "/", which is now the public landing page — every
 * `redirect("/")` guarding an owner screen points here instead. Administrators sign in at /admin. */
export default async function LoginPage() {
  const session = await getSession();
  if (session?.role === "clinic_owner") {
    redirect("/home");
  }

  return (
    <AuthForm
      action={loginClinicOwnerAction}
      eyebrow="CLINIC HP BUILDER"
      title="ログイン"
      submitLabel="ログイン"
      accent="sky"
      footer={{ href: "/signup", label: "アカウントをお持ちでない方はこちら" }}
    />
  );
}
