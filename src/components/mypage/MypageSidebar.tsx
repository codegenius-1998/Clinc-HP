"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/home", label: "ホーム" },
  { href: "/mypage/requests", label: "申請一覧" },
  { href: "/mypage/sites", label: "サイト一覧" },
];

export function MypageSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-8">
      <p className="px-3 text-[13px] tracking-[0.35em] text-slate-400">MY PAGE</p>
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

      <Link
        href="/mypage/apply"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500"
      >
        新規申請
        <span aria-hidden>→</span>
      </Link>
    </aside>
  );
}
