"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/authActions";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ダッシュボード" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/requests", label: "リクエスト管理" },
  { href: "/admin/templates", label: "テンプレート管理" },
  { href: "/admin/departments", label: "部門管理" },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-slate-200 bg-white px-4 py-8">
      <div>
        <p className="px-3 text-[12px] tracking-[0.35em] text-slate-400">ADMIN</p>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-[14px] transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-100 px-3 pt-4">
        <p className="truncate text-[12px] text-slate-400">{email}</p>
        <form action={logoutAction}>
          <button type="submit" className="mt-1 text-[13px] text-slate-400 underline underline-offset-4 hover:text-slate-900">
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
