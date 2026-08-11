import { getSession, listUsers } from "@/lib/auth";
import { listHearings } from "@/lib/hearing";
import { listSites, listDepartments } from "@/lib/content";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminDashboardPage() {
  const session = await getSession();
  const [users, hearings, templates, departments] = await Promise.all([
    listUsers(),
    listHearings(),
    listSites({ isTemplate: true }),
    listDepartments(),
  ]);

  const cards = [
    { label: "ユーザー", value: users.length, href: "/admin/users" },
    { label: "リクエスト", value: hearings.length, href: "/admin/requests" },
    { label: "テンプレート", value: templates.length, href: "/admin/templates" },
    { label: "部門", value: departments.length, href: "/admin/departments" },
  ];

  return (
    <div>
      <AdminPageHeader title="管理者ダッシュボード" description={`${session?.email} でログイン中`} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
          >
            <p className="text-[13px] text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
