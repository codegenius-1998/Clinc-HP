/** The one place a colour written in someone else's CSS is turned into a token this app can store.
 *
 * Extracted from extractDesignSignals so extractStructure can read a reference footer's background
 * with the same parser. Two colour parsers that disagree by one edge case (`#abcd`, `rgb(0 0 0 / .5)`)
 * would show up as a footer classified light while its palette says dark, which is the kind of bug
 * nobody thinks to look for. */

/** `#abc` / `#aabbcc` / `#aabbccdd` / `rgb()` / `rgba()` -> `#rrggbb`, or null when unparseable.
 * Alpha is dropped: a design token is an opaque colour. */
export function normalizeColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();

  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3) return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
    if (digits.length === 6) return `#${digits}`;
    // 4- and 8-digit hex carry alpha; drop it — a template token is an opaque colour.
    if (digits.length === 4) return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
    if (digits.length === 8) return `#${digits.slice(0, 6)}`;
    return null;
  }

  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))));
    if ([r, g, b].some(Number.isNaN)) return null;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }

  return null;
}
