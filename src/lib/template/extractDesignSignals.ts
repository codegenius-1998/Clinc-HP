import * as cheerio from "cheerio";
import { safeFetchText } from "./safeFetch";

/** Reads a reference site and reports what it can measure about its visual design: which colours it
 * actually uses and how often, which fonts, how round its corners are, whether it animates.
 *
 * This is deliberately mechanical — regexes over CSS text rather than a full parser. The output is
 * not the template; it is the evidence the model reasons from in importFromUrl.ts. Getting a few
 * values slightly wrong is fine (an admin edits the result), so the extra weight of a real CSS
 * parser would buy very little.
 *
 * Nothing here downloads or stores the reference site's images. Image URLs are collected only so the
 * model can look at them, which is why they are returned as URLs and never as bytes. */

const MAX_HTML_BYTES = 1_000_000;
const MAX_CSS_FILES = 3;
const MAX_CSS_TOTAL_BYTES = 500_000;

export type Counted = { value: string; count: number };

export type DesignSignals = {
  finalUrl: string;
  pageTitle: string;
  metaDescription: string;
  /** CSS custom properties the site declares — when present these are by far the best evidence,
   * since a site that defines `--primary` has already told us what its primary colour is. */
  customProperties: { name: string; value: string }[];
  colors: Counted[];
  fontFamilies: Counted[];
  googleFonts: string[];
  radii: Counted[];
  shadows: string[];
  transitionDurations: string[];
  keyframeNames: string[];
  imageCandidates: string[];
  cssSources: string[];
  cssBytes: number;
  /** True when the page shipped almost no markup — a client-rendered SPA, where the colours and
   * fonts live in JS the importer never sees. Surfaced so the UI can say so plainly. */
  looksClientRendered: boolean;
};

function normalizeColor(raw: string): string | null {
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

/** OpenAI's vision input accepts jpeg/png/gif/webp only — an SVG logo or an .ico favicon makes the
 * whole request fail, so unsupported formats are dropped at collection time rather than discovered
 * mid-import. URLs with no extension are kept: CDN paths often omit one and are usually fine. */
const UNSUPPORTED_IMAGE_EXTENSION = /\.(svg|ico|bmp|tiff?|avif|heic|pdf)$/i;

function isVisionReadableImage(url: string): boolean {
  try {
    return !UNSUPPORTED_IMAGE_EXTENSION.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function tally(values: string[], limit: number): Counted[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function collect(pattern: RegExp, text: string, group = 1): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[group]?.trim();
    if (value) out.push(value);
  }
  return out;
}

/** Google Fonts <link> hrefs -> the family spec our renderer emits, e.g. "Noto Sans JP:wght@400;700". */
function parseGoogleFontsHref(href: string): string[] {
  try {
    const url = new URL(href, "https://fonts.googleapis.com");
    if (!url.hostname.includes("fonts.googleapis.com")) return [];
    const families = url.searchParams.getAll("family");
    return families.map((f) => f.replace(/\+/g, " ")).filter(Boolean);
  } catch {
    return [];
  }
}

export async function extractDesignSignals(rawUrl: string): Promise<DesignSignals> {
  const page = await safeFetchText(rawUrl, MAX_HTML_BYTES);
  const $ = cheerio.load(page.text);

  const googleFonts = new Set<string>();
  const stylesheetUrls: string[] = [];

  $("link[rel~='stylesheet'], link[rel='preload'][as='style']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const fromGoogle = parseGoogleFontsHref(href);
    if (fromGoogle.length > 0) {
      fromGoogle.forEach((f) => googleFonts.add(f));
      return;
    }
    try {
      stylesheetUrls.push(new URL(href, page.url).href);
    } catch {
      /* malformed href — nothing to do but skip it */
    }
  });

  // Inline <style> blocks first: on many sites these hold the above-the-fold critical CSS, which is
  // exactly the part that decides the visual impression.
  let css = $("style")
    .map((_, el) => $(el).html() ?? "")
    .get()
    .join("\n");

  const cssSources: string[] = [];
  for (const href of stylesheetUrls.slice(0, MAX_CSS_FILES)) {
    if (css.length >= MAX_CSS_TOTAL_BYTES) break;
    try {
      const sheet = await safeFetchText(href, MAX_CSS_TOTAL_BYTES - css.length);
      css += `\n${sheet.text}`;
      cssSources.push(href);
    } catch {
      // A single unreachable stylesheet (403, CDN block, timeout) must not fail the whole import.
      continue;
    }
  }

  const customProperties = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)]
    .map((m) => ({ name: m[1], value: m[2].trim() }))
    .filter((p) => p.value.length > 0 && p.value.length < 120)
    .slice(0, 60);

  const colors = tally(
    collect(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g, css, 1)
      .map(normalizeColor)
      .filter((c): c is string => c !== null),
    14
  );

  const fontFamilies = tally(
    collect(/font-family\s*:\s*([^;{}]+)/gi, css).map((f) => f.replace(/\s+/g, " ").trim()),
    8
  );

  const radii = tally(collect(/border-radius\s*:\s*([^;{}]+)/gi, css), 6);
  const shadows = [...new Set(collect(/box-shadow\s*:\s*([^;{}]+)/gi, css))].slice(0, 6);
  const transitionDurations = [...new Set(collect(/transition[^;{}]*?(\d*\.?\d+m?s)/gi, css))].slice(0, 6);
  const keyframeNames = [...new Set(collect(/@keyframes\s+([\w-]+)/gi, css))].slice(0, 10);

  const imageCandidates: string[] = [];
  function pushImage(raw: string | undefined) {
    if (!raw || raw.startsWith("data:") || imageCandidates.length >= 6) return;
    try {
      const absolute = new URL(raw, page.url).href;
      if (isVisionReadableImage(absolute)) imageCandidates.push(absolute);
    } catch {
      /* malformed src — skip */
    }
  }

  pushImage($("meta[property='og:image']").attr("content"));
  $("img[src]").each((_, el) => pushImage($(el).attr("src")));

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return {
    finalUrl: page.url,
    pageTitle: $("title").first().text().trim(),
    metaDescription: $("meta[name='description']").attr("content")?.trim() ?? "",
    customProperties,
    colors,
    fontFamilies,
    googleFonts: [...googleFonts].slice(0, 4),
    radii,
    shadows,
    transitionDurations,
    keyframeNames,
    imageCandidates: [...new Set(imageCandidates)].slice(0, 6),
    cssSources,
    cssBytes: css.length,
    looksClientRendered: bodyText.length < 400 && css.length < 5_000,
  };
}

/** Compact, model-readable rendering of the signals. Kept as prose rather than raw JSON so the model
 * spends its attention on the values, not on parsing our field names. */
export function describeSignals(signals: DesignSignals): string {
  const lines: string[] = [
    `URL: ${signals.finalUrl}`,
    signals.pageTitle && `ページタイトル: ${signals.pageTitle}`,
    signals.metaDescription && `ページ概要: ${signals.metaDescription}`,
    `取得できたCSSの量: ${signals.cssBytes}文字（${signals.cssSources.length}ファイル＋インライン）`,
  ].filter((l): l is string => Boolean(l));

  if (signals.customProperties.length > 0) {
    lines.push(
      "",
      "## サイトが自分で定義しているCSS変数（最も信頼できる手がかり）",
      ...signals.customProperties.map((p) => `- ${p.name}: ${p.value}`)
    );
  }
  lines.push("", "## よく使われている色（出現回数順）", ...signals.colors.map((c) => `- ${c.value} (${c.count}回)`));
  lines.push("", "## font-family の指定", ...signals.fontFamilies.map((f) => `- ${f.value} (${f.count}回)`));
  if (signals.googleFonts.length > 0) {
    lines.push("", "## 読み込んでいるGoogle Fonts", ...signals.googleFonts.map((f) => `- ${f}`));
  }
  lines.push("", "## border-radius の指定", ...signals.radii.map((r) => `- ${r.value} (${r.count}回)`));
  if (signals.shadows.length > 0) lines.push("", "## box-shadow の指定", ...signals.shadows.map((s) => `- ${s}`));
  if (signals.transitionDurations.length > 0) {
    lines.push("", "## transition の時間", ...signals.transitionDurations.map((d) => `- ${d}`));
  }
  if (signals.keyframeNames.length > 0) {
    lines.push("", "## @keyframes の名前", ...signals.keyframeNames.map((k) => `- ${k}`));
  }
  if (signals.looksClientRendered) {
    lines.push(
      "",
      "## 注意",
      "このページはJavaScriptで描画されるタイプのサイトで、HTML/CSSからほとんど情報が取れていない。添付画像があればそちらを主な判断材料にすること。"
    );
  }

  return lines.join("\n");
}
