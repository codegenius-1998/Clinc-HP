/** Tiny colour helpers for the generation guardrails in `normalize.ts`. The model picks a palette
 * and sometimes picks one that is too pale to read (headings that vanish into the page, a reserve
 * button with white text on near-white pink). These functions measure WCAG contrast and darken a
 * colour just enough to clear a target ratio, keeping its hue. */

export type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Scales a colour toward black in small steps until it reaches `target` contrast against `against`.
 * Returns the input unchanged when it already clears the bar or when black itself cannot. */
export function deepenUntilContrast(color: Rgb, against: Rgb, target: number): Rgb {
  if (contrast(color, against) >= target) return color;
  let cur = { ...color };
  for (let i = 0; i < 24; i++) {
    cur = { r: cur.r * 0.9, g: cur.g * 0.9, b: cur.b * 0.9 };
    if (contrast(cur, against) >= target) break;
  }
  return { r: Math.round(cur.r), g: Math.round(cur.g), b: Math.round(cur.b) };
}

/** As above but operating on hex strings; falls back to `fallback` when `hex` cannot be parsed. */
export function ensureReadable(hex: string, againstHex: string, target: number, fallback: string): string {
  const c = parseHex(hex);
  const bg = parseHex(againstHex) ?? { r: 255, g: 255, b: 255 };
  if (!c) return fallback;
  return toHex(deepenUntilContrast(c, bg, target));
}
