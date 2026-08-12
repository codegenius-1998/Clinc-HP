"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ダッシュボード" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/requests", label: "リクエスト管理" },
  { href: "/admin/templates", label: "テンプレート管理" },
  { href: "/admin/sections", label: "セクション管理" },
  { href: "/admin/departments", label: "部門管理" },
  { href: "/admin/features", label: "特徴管理" },
  { href: "/admin/targets", label: "ターゲット管理" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-8">
      <p className="px-3 text-[13px] tracking-[0.35em] text-slate-400">ADMIN</p>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2.5 text-[16px] transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
