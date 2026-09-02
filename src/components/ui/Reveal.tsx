"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Fades a section in as it scrolls into view, for the app's own marketing and owner pages.
 *
 * Two things keep it from being able to hide content permanently, which is the only real risk of a
 * pattern like this. The `js` class is added by this component on mount, and the CSS only hides
 * anything when that class is present, so a browser that never runs the script shows everything.
 * And the whole rule sits inside `prefers-reduced-motion: no-preference`, so a reader who has asked
 * their OS for less motion gets a page with none. */
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  move,
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Milliseconds, for staggering a row of cards. Kept small — a long stagger reads as a slow page. */
  delay?: number;
  /** Which way the element travels in from. Omitted means straight up, which is what most of the
   * page uses; the others exist so a row of cards can arrive from the side it sits on rather than
   * every block on the page sliding upward in unison. The travel distances live in globals.css
   * under `[data-move]`, inside the same reduced-motion guard as everything else. */
  move?: "left" | "right" | "scale" | "none";
  /** Keep the reveal one-way. Set false only for something meant to re-play, which for a page of
   * text is almost never — re-animating a paragraph the reader has already read is a distraction. */
  once?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("js");

    const element = ref.current;
    if (!element) return;

    // ⚠️ Anything already on screen is shown outright, without involving the observer at all.
    //
    // Relying on IntersectionObserver's initial callback for this is what it looks like it is for,
    // and it is very nearly right — but an element sitting exactly at the fold is measured AFTER the
    // reveal transform has already pushed it 18px down, so it can land just outside the observer's
    // shrunken root and never be reported. That is not a cosmetic miss: nothing scrolls it back into
    // view later, so the block stays invisible for the whole visit. It happened to the first cell of
    // the landing page's numbers row, and only to the first cell, which is exactly how a race
    // presents itself. The observer below is now only responsible for what is genuinely below the
    // fold.
    if (element.getBoundingClientRect().top < window.innerHeight) {
      setShown(true);
      if (once) return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      data-move={move}
      className={`app-reveal ${shown ? "app-reveal-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
