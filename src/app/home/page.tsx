import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const LINKS = [
  { href: "/mypage/apply", label: "新規申請", description: "ホームページ作成の申請を行います。" },
  { href: "/mypage/requests", label: "申請一覧", description: "送信した申請の状態を確認します。" },
  { href: "/mypage/sites", label: "サイト一覧", description: "生成が完了したホームページを確認します。" },
  { href: "/create", label: "ホームページ作成（従来フォーム）", description: "デザイン選択まで一括で行う旧フォームです。" },
  { href: "/sites", label: "閲覧", description: "作成済みのホームページを一覧で確認します。" },
];

export default async function Home() {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    redirect("/");
  }

  return (
    <div>
      <AdminPageHeader
        title="ホーム"
        description="医院の情報を入力するだけで、テンプレートに沿ったホームページを作成できます。"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 transition-colors hover:border-sky-300 hover:bg-sky-50/40"
          >
            <p className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
              {link.label}
              <span aria-hidden className="text-sky-500">
                →
              </span>
            </p>
            <p className="mt-1 text-[13px] text-slate-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
