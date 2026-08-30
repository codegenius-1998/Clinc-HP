/** The Japanese-capable Google Fonts the generated sites are allowed to use, plus helpers to build
 * a consistent `theme.fonts` object from a chosen pair. Shared by `normalize.ts` (server, forces a
 * safe family when the model picks a Latin-only face like Roboto) and the site editor (client, the
 * font `<select>`s). Pure data + string building — no imports. */

export const JP_FONTS: Record<string, { weights: string; fallback: string; note: string }> = {
  "Zen Kaku Gothic New": {
    weights: "400;500;700",
    fallback: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    note: "標準的なゴシック体。読みやすく万能",
  },
  "Noto Sans JP": {
    weights: "400;500;700",
    fallback: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    note: "ニュートラルなゴシック体",
  },
  "Zen Maru Gothic": {
    weights: "400;500;700",
    fallback: '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
    note: "丸ゴシック。やわらかく親しみやすい",
  },
  "M PLUS Rounded 1c": {
    weights: "400;500;700",
    fallback: '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
    note: "丸ゴシック。ポップで明るい",
  },
  "Kosugi Maru": {
    weights: "400",
    fallback: '"Hiragino Maru Gothic ProN", sans-serif',
    note: "軽めの丸ゴシック",
  },
  "BIZ UDPGothic": {
    weights: "400;700",
    fallback: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    note: "UD書体。かっちり読みやすい",
  },
  "Klee One": {
    weights: "400;600",
    fallback: '"Hiragino Mincho ProN", "Yu Mincho", serif',
    note: "教科書体風の筆記。手書きのあたたかみ",
  },
  "Shippori Mincho": {
    weights: "400;600;700",
    fallback: '"Hiragino Mincho ProN", "Yu Mincho", serif',
    note: "明朝体。落ち着いて上品",
  },
  "Zen Old Mincho": {
    weights: "400;600;700",
    fallback: '"Hiragino Mincho ProN", "Yu Mincho", serif',
    note: "明朝体。伝統的で信頼感",
  },
  "Zen Kaku Gothic Antique": {
    weights: "400;500;700",
    fallback: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    note: "少し古風なゴシック体",
  },
};

export type JpFontName = keyof typeof JP_FONTS;

export const DEFAULT_HEADING_FONT = "Klee One";
export const DEFAULT_BODY_FONT = "Zen Kaku Gothic New";

export const FONT_NAMES = Object.keys(JP_FONTS);

/** First family name out of a CSS font stack (`"Klee One", serif` → `Klee One`). */
export function parseFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}

export function isJpFont(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(JP_FONTS, name);
}

function coerce(name: string, fallback: string): string {
  return isJpFont(name) ? name : fallback;
}

export function fontStack(name: string): string {
  const def = JP_FONTS[name] ?? JP_FONTS[DEFAULT_BODY_FONT];
  return `"${name}", ${def.fallback}`;
}

export function googleHref(headingName: string, bodyName: string): string {
  const fam = (n: string) =>
    `family=${n.replace(/ /g, "+")}:wght@${(JP_FONTS[n] ?? JP_FONTS[DEFAULT_BODY_FONT]).weights}`;
  const parts = headingName === bodyName ? [fam(headingName)] : [fam(headingName), fam(bodyName)];
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

/** Builds a fully-consistent `theme.fonts` from whatever the model (or editor) supplied: a
 * Latin-only or unknown family is swapped for a Japanese default, and `googleHref` is always
 * rebuilt from the resolved pair so the `<link>` and the `font-family` can never disagree. */
export function resolveFontTheme(
  rawHeading: string,
  rawBody: string,
  tracking: string
): { heading: string; body: string; googleHref: string; headingTracking: string } {
  const h = coerce(parseFamily(rawHeading), DEFAULT_HEADING_FONT);
  const b = coerce(parseFamily(rawBody), DEFAULT_BODY_FONT);
  return {
    heading: fontStack(h),
    body: fontStack(b),
    googleHref: googleHref(h, b),
    headingTracking: /^0?\.\d+em$/.test(tracking.trim()) ? tracking.trim() : "0.08em",
  };
}
