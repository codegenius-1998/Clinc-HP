"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** The landing page's header: transparent over the hero photograph, solid once the reader leaves it,
 * with a drawer instead of a nav bar on a phone.
 *
 * The two states exist because the header sits ON the hero image. White-on-photograph is legible
 * there and illegible everywhere else, so the bar has to change rather than pick one compromise
 * colour that is slightly wrong on both. The switch is driven by a passive scroll listener that only
 * ever writes a boolean, so it re-renders at most twice per direction change, not per frame.
 *
 * ⚠️ Anything here that hides content must survive JavaScript never running. The desktop nav and both
 * CTAs are plain links in the markup; only the drawer's OPEN state is client-side, and the drawer is
 * a duplicate of links that already exist in the footer. */

const SECTIONS = [
  { href: "#features", label: "特徴" },
  { href: "#showcase", label: "できあがるもの" },
  { href: "#flow", label: "制作の流れ" },
  { href: "#assurance", label: "安心のしくみ" },
];

export function LandingHeader({ signedInHref }: { signedInHref: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy. `-45% 0px -50%` collapses the viewport to a band just above the middle of the screen,
  // so the highlighted item is whichever section the reader is actually looking at rather than
  // whichever one happens to have a pixel on screen.
  useEffect(() => {
    const targets = SECTIONS.map((section) => document.querySelector(section.href)).filter(
      (el): el is Element => Boolean(el)
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // A drawer that leaves the page scrollable behind it is a well-known way to lose your reading
  // position, so the body is pinned for exactly as long as the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onDark = !scrolled && !open;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
          onDark ? "bg-transparent" : "border-b border-line bg-paper/92 backdrop-blur-md"
        }`}
      >
        {/* Reading progress. Pure CSS (scroll-driven animation) where supported; a flat rule that
            never moves everywhere else, which is why it is drawn at low contrast. */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-transparent">
          <div className="scroll-progress h-full w-full origin-left bg-brand/70" />
        </div>

        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className={`font-display text-[17px] tracking-[0.16em] transition-colors ${
              onDark ? "text-white" : "text-ink"
            }`}
          >
            Clinc HP
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] lg:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className={`relative py-1 transition-colors ${
                  onDark ? "text-white/75 hover:text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {section.label}
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-current transition-transform duration-500 ${
                    active === section.href ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {signedInHref ? (
              <Link
                href={signedInHref}
                className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-brand-deep"
              >
                管理画面へ
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`hidden px-3 py-2 text-[13px] transition-colors sm:block ${
                    onDark ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  ログイン
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-brand-deep"
                >
                  はじめる
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="landing-drawer"
              aria-label={open ? "メニューを閉じる" : "メニューを開く"}
              className={`ml-1 flex h-10 w-10 items-center justify-center lg:hidden ${
                onDark ? "text-white" : "text-ink"
              }`}
            >
              <span className="relative block h-3 w-5">
                <span
                  className={`absolute left-0 block h-px w-full bg-current transition-transform duration-300 ${
                    open ? "top-1.5 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1.5 block h-px w-full bg-current transition-opacity duration-200 ${
                    open ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-px w-full bg-current transition-transform duration-300 ${
                    open ? "top-1.5 -rotate-45" : "top-3"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="landing-drawer"
        hidden={!open}
        className="fixed inset-0 z-40 bg-paper px-6 pb-10 pt-24 lg:hidden"
      >
        <nav className="flex flex-col">
          {SECTIONS.map((section, index) => (
            <a
              key={section.href}
              href={section.href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: `${80 + index * 60}ms` }}
              className={`flex items-center justify-between border-b border-line py-5 font-display text-[19px] tracking-[0.08em] text-ink transition-all duration-500 ${
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              {section.label}
              <span aria-hidden className="text-[13px] text-brand">
                →
              </span>
            </a>
          ))}
        </nav>
        <Link
          href={signedInHref ?? "/signup"}
          onClick={() => setOpen(false)}
          className="mt-10 flex items-center justify-center gap-3 rounded-full bg-brand px-8 py-4 text-[14px] font-medium text-paper"
        >
          {signedInHref ? "管理画面へ" : "無料ではじめる"}
          <span aria-hidden>→</span>
        </Link>
        {!signedInHref && (
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-5 block text-center text-[13px] text-ink-soft underline underline-offset-8"
          >
            すでにアカウントをお持ちの方
          </Link>
        )}
      </div>
    </>
  );
}
