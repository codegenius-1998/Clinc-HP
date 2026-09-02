import { listUsers } from "@/lib/auth";
import { listHearings } from "@/lib/hearing";
import { listDepartments } from "@/lib/content";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminDashboardPage() {
  const [users, hearings, departments] = await Promise.all([listUsers(), listHearings(), listDepartments()]);

  const cards = [
    { label: "ユーザー", value: users.length, href: "/admin/users" },
    { label: "リクエスト", value: hearings.length, href: "/admin/requests" },
    { label: "部門", value: departments.length, href: "/admin/departments" },
  ];

  return (
    <div>
      <AdminPageHeader title="管理者ダッシュボード" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
          >
            <p className="text-[15px] text-slate-500">{card.label}</p>
            <p className="mt-2 text-4xl font-semibold text-slate-900">{card.value}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
