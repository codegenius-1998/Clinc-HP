/** Small colour helpers used when turning design tokens into CSS.
 *
 * These exist because a template's palette comes from an arbitrary reference site, so no pairing of
 * colours can be assumed readable. A brand accent is often a bright yellow or lime that looks right
 * as a button fill and is illegible as body text on white — and the importer has no way to know
 * which use the reference site intended. Rather than ask the model to get that right, the renderer
 * derives a guaranteed-readable variant (see `readableOn`). */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
export function luminance(rgb: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return 1;
  const lumA = luminance(rgbA);
  const lumB = luminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** Returns `color` if it is already readable on `background`, otherwise the nearest darker (or, on a
 * dark background, lighter) version of it that clears `minRatio`. Hue is preserved — the result still
 * reads as the brand colour, just usable as text.
 *
 * `fallback` is returned only when even pure black/white against that background can't reach the
 * ratio, which in practice means the background itself is mid-grey. */
export function readableOn(color: string, background: string, fallback: string, minRatio = 4.5): string {
  if (contrastRatio(color, background) >= minRatio) return color;

  const rgb = hexToRgb(color);
  const bg = hexToRgb(background);
  if (!rgb || !bg) return fallback;

  // Darken on a light background, lighten on a dark one.
  const target = luminance(bg) > 0.4 ? BLACK : WHITE;
  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = rgbToHex(mix(rgb, target, amount));
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return fallback;
}
