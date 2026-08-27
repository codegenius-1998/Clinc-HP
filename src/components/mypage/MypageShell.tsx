import Link from "next/link";
import { logoutAction } from "@/lib/authActions";

/** The clinic owner's chrome: top bar and page heading.
 *
 * Split out from the admin panel's equivalents rather than shared with them. They looked identical
 * because they WERE identical — the owner screens imported AdminTopBar and AdminPageHeader — which is
 * the whole reason a clinic owner's first impression of this product was "an internal tool". The two
 * audiences want different things from the same information, so from here they diverge: the admin
 * side keeps its dense slate/sky panel, and this side gets the typographic treatment the marketing
 * page introduces. Nothing under src/app/admin imports this file, and nothing here imports theirs. */

export function MypageTopBar({ email }: { email: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-paper px-5 sm:px-8">
      <Link href="/home" className="font-display text-[16px] tracking-[0.14em] text-ink">
        Clinc HP
      </Link>
      <div className="flex items-center gap-5">
        <span className="hidden truncate text-[13px] text-ink-soft sm:block">{email}</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-[13px] text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  );
}

export function MypagePageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-9">
      <h1 className="font-display text-[26px] tracking-[0.1em] text-ink">{title}</h1>
      {description && <p className="mt-3 max-w-2xl text-[14px] leading-[1.9] text-ink-soft">{description}</p>}
    </div>
  );
}

/** The one call-to-action shape used across the owner screens, so "新規申請" looks the same wherever
 * it appears. */
export function MypagePrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-[13px] font-medium text-paper transition-transform hover:-translate-y-0.5 hover:bg-brand-deep"
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}
