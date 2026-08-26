"use client";

import { useEffect, useRef, useState } from "react";

/** A number that counts up to its value the first time it is scrolled past.
 *
 * The finished number is what renders on the server, so it is what a reader without JavaScript sees,
 * and it is what stays on screen for a reader who has asked for reduced motion. The count only ever
 * starts if the element is still BELOW the fold when this mounts — an element already on screen keeps
 * its value rather than flashing back to zero and climbing again, which would look like a bug. */
export function CountUp({
  value,
  suffix = "",
  decimals = 0,
  duration = 1400,
  className = "",
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    setDisplay(0);
    let frame = 0;
    let start = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          const step = (now: number) => {
            if (!start) start = now;
            // easeOutCubic: fast at first, settling at the end — a linear count reads as a stopwatch.
            const t = Math.min(1, (now - start) / duration);
            setDisplay(value * (1 - Math.pow(1 - t, 3)));
            if (t < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }
      },
      { rootMargin: "0px 0px -15% 0px" }
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
