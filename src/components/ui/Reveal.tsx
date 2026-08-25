"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Fades a section in as it scrolls into view, for the app's own marketing and owner pages.
 *
 * Not shared with the generated clinic sites. Those get their reveal from src/lib/render/site.css and
 * js/main.js, which are written into each site as plain static files — this is React, runs in the
 * app, and the two must not learn about each other.
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
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Milliseconds, for staggering a row of cards. Kept small — a long stagger reads as a slow page. */
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("js");

    const element = ref.current;
    if (!element) return;

    // An element already on screen at first paint (the hero) must not wait for a scroll that may
    // never come, and IntersectionObserver fires immediately for exactly that case.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`app-reveal ${shown ? "app-reveal-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
