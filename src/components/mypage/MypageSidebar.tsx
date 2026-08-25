"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/home", label: "ホーム" },
  { href: "/mypage/requests", label: "申請一覧" },
  { href: "/mypage/sites", label: "サイト一覧" },
];

/** Renders as a fixed 256px column on desktop, but that same width would swallow most of a phone's
 * viewport and leave the actual page content with nothing to stretch into — so below `lg` this
 * switches to a horizontal, scrollable nav strip that stacks above the content instead of beside it
 * (see the `flex-col lg:flex-row` wrapper in mypage/layout.tsx). */
export function MypageSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line bg-paper px-4 py-3 lg:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
              isActive(item.href) ? "bg-ink text-paper" : "text-ink-soft hover:bg-canvas"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/mypage/apply"
          className="ml-auto shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-medium text-paper"
        >
          新規申請
        </Link>
      </nav>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-paper px-4 py-9 lg:flex">
        <p className="px-3 text-[11px] tracking-[0.35em] text-ink-soft">MY PAGE</p>
        <nav className="mt-7 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // The active item is a solid ink block rather than a tint: at this size a pale
              // background is easy to miss, and "which page am I on" is the one thing a sidebar
              // has to answer at a glance.
              className={`rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                isActive(item.href) ? "bg-ink text-paper" : "text-ink-soft hover:bg-canvas"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/mypage/apply"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-[13px] font-medium text-paper transition-transform hover:-translate-y-0.5 hover:bg-brand-deep"
        >
          新規申請
          <span aria-hidden>→</span>
        </Link>
      </aside>
    </>
  );
}
