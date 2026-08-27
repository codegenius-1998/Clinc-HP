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

/** The mirror image of `readableOn`: instead of adjusting the text, adjust the FILL it sits on.
 *
 * Which one is right depends on what the colour is for. A brand colour used as a heading is text, so
 * `readableOn` darkens the text. A brand colour used as a button or a navigation bar is a surface,
 * and darkening the white label on top of it would look like a mistake — the surface is what has to
 * move. The stock palette is exactly this case: white on #4ba3fc is 2.6:1, and the fix a designer
 * would make is a deeper blue, not grey lettering.
 *
 * Hue is preserved, so the result still reads as the brand colour. Returns `fill` untouched when the
 * pair already clears `minRatio`, which is why a well-chosen palette is never altered. */
export function readableFill(fill: string, label: string, minRatio = 4.5): string {
  if (contrastRatio(fill, label) >= minRatio) return fill;

  const rgb = hexToRgb(fill);
  const labelRgb = hexToRgb(label);
  if (!rgb || !labelRgb) return fill;

  // A light label needs a darker surface, and vice versa.
  const target = luminance(labelRgb) > 0.4 ? BLACK : WHITE;
  for (let amount = 0.05; amount <= 1; amount += 0.05) {
    const candidate = rgbToHex(mix(rgb, target, amount));
    if (contrastRatio(candidate, label) >= minRatio) return candidate;
  }
  return rgbToHex(target);
}

/** Rotates a colour around the hue wheel, leaving saturation and lightness alone.
 *
 * Used to give each clinic its own shade of the template's palette (see derivePalette in
 * composition.ts). Rotation rather than replacement is the point: a small turn keeps a blue template
 * blue, so the template still reads as the thing the admin approved, while two clinics built from it
 * are no longer pixel-identical. Grey stays grey — with saturation at 0 there is no hue to turn. */
export function rotateHue(hex: string, degrees: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return hex;

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + degrees + 360) % 360;

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  const [r1, g1, b1] =
    hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  return rgbToHex({ r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 });
}

/** A stable number in [0, 1) from a string. Deterministic on purpose: rebuilding a site must produce
 * the colours it had before, or every regeneration would silently redecorate a live page. */
export function hashToUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}
