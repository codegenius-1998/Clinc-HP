import type { ReactNode } from "react";

/** セクション内で使う簡易イラスト(すべて inline SVG・線画)。色は currentColor で親の CSS が決める。
 * 「診療案内」は treatments.key、「当院が選ばれる理由」は index で名前を渡す。
 * 外部画像は使わない(仕様: imagery は all inline SVG)。 */

const tooth: ReactNode = (
  <path d="M32 13c-6-4-18-3-18 8 0 7 3 10 4 17 1 6 1 13 4 13s3-6 4-11c.6-3 2.4-3 3 0 1 5 1 11 4 11s3-7 4-13c1-7 4-10 4-17 0-11-12-12-18-8Z" />
);

const SHAPES: Record<string, ReactNode> = {
  // --- 当院が選ばれる理由 ---
  explain: (
    <>
      <rect x="9" y="12" width="46" height="32" rx="3" />
      <path d="M26 44v6M38 44v6M20 50h24" />
      <path d="M23 27l6 6 12-13" />
    </>
  ),
  shopping: (
    <>
      <path d="M17 23h30l-2.6 28a4 4 0 0 1-4 3.6H23.6a4 4 0 0 1-4-3.6Z" />
      <path d="M25 23v-3a7 7 0 0 1 14 0v3" />
      <path d="M32 33v13M25.5 39.5h13" />
    </>
  ),
  kids: (
    <>
      <circle cx="24" cy="17" r="6" />
      <path d="M13 51c0-8 5-13 11-13s11 5 11 13" />
      <circle cx="43" cy="24" r="5" />
      <path d="M35 51c0-6 4-10 8-10s8 4 8 10" />
    </>
  ),

  // --- 診療案内 (treatments.key) ---
  caries: (
    <>
      {tooth}
      <circle cx="45" cy="43" r="8" />
      <path d="M51 49l6 6" />
    </>
  ),
  perio: (
    <>
      {tooth}
      <path d="M12 47c5 3 8 3 13 0M39 47c5 3 8 3 13 0" />
    </>
  ),
  ortho: (
    <>
      <path d="M10 24c9 18 35 18 44 0" />
      <rect x="14" y="22" width="7" height="7" rx="1.5" />
      <rect x="28.5" y="33" width="7" height="7" rx="1.5" />
      <rect x="43" y="22" width="7" height="7" rx="1.5" />
    </>
  ),
  general: <>{tooth}</>,
  pediatric: (
    <>
      <path d="M31 21c-4-3-13-2-13 6 0 5 2 7 3 12 .7 4 .7 8 3 8s2-4 2.6-7c.4-2 1.6-2 2 0 .6 3 .6 7 2.8 7s2.3-4 3-8c1-5 3-7 3-12 0-8-9-9-13-6Z" />
      <path d="M47 13l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
    </>
  ),
  preventive: (
    <>
      <path d="M32 10l18 6v13c0 13-9 22-18 26-9-4-18-13-18-26V16Z" />
      <path d="M23 31l6 7 13-14" />
    </>
  ),
  "oral-surgery": (
    <>
      {tooth}
      <path d="M45 11v11M39.5 16.5h11" />
    </>
  ),
  whitening: (
    <>
      {tooth}
      <path d="M47 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
      <path d="M53 28l1.2 3 3 1.2-3 1.2L53 37l-1.2-3-3-1.2 3-1.2Z" />
    </>
  ),

  // --- 皮膚科向け ---
  skin: (
    <>
      <rect x="12" y="12" width="40" height="40" rx="11" />
      <circle cx="26" cy="27" r="2.4" />
      <circle cx="39" cy="23" r="1.8" />
      <circle cx="34" cy="41" r="3.2" />
      <circle cx="44" cy="38" r="1.6" />
    </>
  ),
  allergy: (
    <>
      <circle cx="32" cy="32" r="8" />
      <path d="M32 12v7M32 45v7M12 32h7M45 32h7M18 18l5 5M41 41l5 5M46 18l-5 5M18 46l5-5" />
    </>
  ),
  cosmetic: (
    <>
      <path d="M22 22c0-7 4-11 10-11s10 4 10 11c0 4 0 8-2 12-1.6 3-4.4 6-8 6s-6.4-3-8-6c-2-4-2-8-2-12Z" />
      <path d="M27 27h.01M37 27h.01M28 37c2 2 6 2 8 0" />
      <path d="M47 13l1.6 4 4 1.6-4 1.6L47 26l-1.6-4-4-1.6 4-1.6Z" />
    </>
  ),
  "derm-surgery": (
    <>
      <circle cx="32" cy="32" r="18" />
      <path d="M32 23v18M23 32h18" />
    </>
  ),
  uv: (
    <>
      <circle cx="32" cy="24" r="9" />
      <path d="M32 6v6M14 24h6M50 24h6M18 10l4 4M46 10l-4 4" />
      <path d="M12 44c8-9 32-9 40 0" />
      <path d="M22 44v9M32 44v11M42 44v9" />
    </>
  ),
  piercing: (
    <>
      <path d="M24 17c8-4 17 0 17 11 0 7-4 10-4 15 0 5-4 8-8 8s-6-3-6-7" />
      <circle cx="31" cy="43" r="2.6" />
    </>
  ),
  mole: (
    <>
      <circle cx="28" cy="28" r="12" />
      <circle cx="28" cy="28" r="3.4" />
      <path d="M37 37l9 9" />
    </>
  ),
  certified: (
    <>
      <circle cx="32" cy="25" r="12" />
      <path d="M23 34l-3 16 12-6 12 6-3-16" />
      <path d="M26 25l4 4 8-9" />
    </>
  ),
  pin: (
    <>
      <path d="M32 54s16-14 16-27a16 16 0 0 0-32 0c0 13 16 27 16 27Z" />
      <circle cx="32" cy="27" r="6" />
    </>
  ),
  clock: (
    <>
      <circle cx="32" cy="32" r="18" />
      <path d="M32 21v12l8 5" />
    </>
  ),
};

export function Illustration({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-hidden focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SHAPES[name] ?? SHAPES.general}
      </g>
    </svg>
  );
}
