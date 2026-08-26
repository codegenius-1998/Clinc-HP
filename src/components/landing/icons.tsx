/** Line icons for the landing page's four feature cards.
 *
 * Drawn by hand as SVG rather than generated, for the same reason the device mockups are real
 * screenshots: an icon is a 24px shape where every stroke is visible, and an image model produces a
 * JPEG of an approximate one — soft edges, a background that is nearly-but-not-quite white, and no
 * way to recolour it with the rest of the page. These inherit `currentColor` and stay crisp.
 *
 * `strokeWidth` is 1.25 rather than the usual 1.5: at the 44px these are displayed, a heavier stroke
 * competes with the headline sitting beside it. */

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** A page with a pen — the copy this app writes for you. */
export function IconWriting({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={className}>
      <path d="M14 3H6a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6 21h9a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M14 3l3.5 4H14z" />
      <path d="M8 12h5M8 15.5h4" />
      <path d="M19.5 12.5l-4.7 4.7-1.9.5.5-1.9 4.7-4.7a1 1 0 0 1 1.4 1.4z" />
    </svg>
  );
}

/** A frame with a horizon inside it, half of it empty — a page that works without photographs. */
export function IconImage({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <path d="M3 15.5l4.2-3.6 3.3 2.6 2.6-2.2L21 17" />
      <circle cx="8.4" cy="8.8" r="1.3" />
    </svg>
  );
}

/** A shield with a tick — the medical-advertising wording check. */
export function IconShield({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3l7 2.6v6c0 4.2-2.9 7.7-7 9.4-4.1-1.7-7-5.2-7-9.4v-6z" />
      <path d="M9 12.2l2.1 2.1L15.4 10" />
    </svg>
  );
}

/** A phone and a desktop measured against each other — the layout check. */
export function IconRuler({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={className}>
      <rect x="2.5" y="5" width="12" height="9.5" rx="1.2" />
      <path d="M6 17.5h5.5" />
      <rect x="16.5" y="8.5" width="5" height="11" rx="1.2" />
      <path d="M18.4 17.6h1.2" />
    </svg>
  );
}
