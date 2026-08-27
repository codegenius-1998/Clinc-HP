import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { hexToRgb, luminance } from "@/lib/site/color";
import type { BlockType } from "@/lib/site/document";
import { normalizeColor } from "./cssColor";

/** Reads a reference site's SKELETON: how many pages it has, what its sections are, how many cards
 * they hold, and what shape its header, hero and footer take.
 *
 * This is the half of "参考サイトを真似る" that was missing. extractDesignSignals answers "what does
 * it look like" (colour, type, radius, motion); nothing answered "how is it built", so every imported
 * template took its palette from the reference site and its entire structure from a constant — which
 * is why four templates imported from four different sites differed only in colour.
 *
 * ⚠️ Nothing here is used as CONTENT. A heading is read to decide *which kind of section* it is, and
 * the heading text itself is passed on only in the one case where our own classification failed —
 * see `unmatchedHeading`. Card text, body copy, images and the clinic's name never leave this file.
 *
 * ⚠️ Third-party class names are worthless as evidence. Every rule below keys on structure — tag
 * names, sibling counts, whether a group of siblings share one class STRING (not which one) — so it
 * works the same on a WordPress theme, a hand-written page and a page builder's output. */

const NAV_LABEL_MAX = 12;
const MAX_SECTIONS = 14;
/** Per section. A page builder can emit thousands of nested divs, and the card scan is the one loop
 * here whose cost is not bounded by the number of headings. */
const MAX_CARD_SCAN = 400;
/** Cheap guards on loops whose cost is set by someone else's markup, not by ours. */
const MAX_CSS_RULES = 4_000;
const MAX_CLASS_PROBE = 200;
/** How much of the page's text an "opening block" may hold before it is really the whole page. */
const HERO_TEXT_SHARE = 0.4;
/** A sibling group narrower than this is a heading + body, not a card row; wider is a link list. */
const CARD_GROUP = { min: 2, max: 8 } as const;
/** How much of a sibling group must agree before it counts as "the same thing repeated". */
const AGREEMENT = 0.7;

/** Nav entries that exist on every site and say nothing about its structure. */
const NON_CONTENT_NAV =
  /(プライバシー|個人情報|サイトマップ|利用規約|特定商取引|copyright|privacy|sitemap|instagram|facebook|twitter|youtube|tiktok|採用|求人|english)/i;

/** Heading -> block type. Order matters: 「診療時間」 must reach `hours` before 「診療」 reaches `rich`,
 * and 「院長挨拶」 must reach the greeting rule before 「院長」 reaches `staff`.
 *
 * Deliberately conservative. A heading that matches nothing is reported as unmatched rather than
 * guessed at — the model reads those and decides, which is what it is better at than a regex. */
const SECTION_KEYWORDS: { kind: BlockType; pattern: RegExp }[] = [
  { kind: "news", pattern: /(お知らせ|新着|ニュース|topics|news)/i },
  { kind: "hours", pattern: /(診療時間|受付時間|診療日|外来担当|営業時間|開院時間)/i },
  { kind: "access", pattern: /(アクセス|交通|地図|所在地|access|map)/i },
  { kind: "pricing", pattern: /(料金|費用|価格|自費|自由診療|price)/i },
  { kind: "faq", pattern: /(よくある|q\s*&\s*a|q&a|faq|ご質問|質問)/i },
  { kind: "contact", pattern: /(お問い合わせ|問合せ|ご予約|予約|contact|reservation|ご相談)/i },
  { kind: "staff", pattern: /(スタッフ|医師|ドクター|staff|doctor|院長紹介)/i },
  { kind: "gallery", pattern: /(院内|施設|設備|ギャラリー|gallery|clinic\s*tour)/i },
  { kind: "rich", pattern: /(ご挨拶|あいさつ|院長|理念|想い|方針|about)/i },
  { kind: "rich", pattern: /(特徴|こだわり|選ばれる|強み|ポイント|約束|安心)/i },
  { kind: "rich", pattern: /(診療案内|診療科|診療内容|治療|外来|メニュー|できること|service)/i },
];

export type StructureNavItem = {
  /** Kept only to decide "is this a real content page"; never written into the template. */
  label: string;
  /** Origin-relative, without a trailing slash or `index.html`. `""` is the home page. */
  pathname: string;
  depth: number;
};

export type StructureSection = {
  /** What kind of section this looks like, or null when no keyword matched. */
  kind: BlockType | null;
  /** ⚠️ Set ONLY when `kind` is null — the single place a reference site's own words are passed on,
   * and then only so the model can classify what our keyword list could not. Truncated hard. */
  unmatchedHeading: string;
  level: number;
  hasImage: boolean;
  /** Size of the largest repeated sibling group inside the section — the reference site's own
   * answer to "how many cards", which is what `cardCount` on a block plan becomes. 0 = no group. */
  cardCount: number;
  cardsHaveImages: boolean;
  hasTable: boolean;
  hasList: boolean;
  textLength: number;
};

export type StructureSignals = {
  navItems: StructureNavItem[];
  sections: StructureSection[];
  heroForm: "full-bleed" | "split" | "centered" | "none";
  /** ⚠️ Never "stacked". A stacked header (brand centred above the nav row) is a layout fact that
   * lives entirely in CSS the importer cannot attribute reliably, so it is left to the model, which
   * can see it in a screenshot. Reporting a form we cannot prove would be worse than reporting the
   * default — see the same reasoning on `footerForm`. */
  headerForm: "bar" | "minimal";
  footerForm: "dark" | "light" | "compact";
  /** Distinct same-origin pages the nav points at. 1 means the reference site is a one-pager —
   * which is exactly what this app has been producing, and worth knowing before copying it. */
  distinctPages: number;
};

type Scope = Cheerio<AnyNode>;

function tagName(node: AnyNode): string {
  return (node as Element).tagName?.toLowerCase() ?? "";
}

function textLength(scope: Scope): number {
  return scope.text().replace(/\s+/g, "").length;
}

/** Class names that some CSS rule gives a background image to.
 *
 * ⚠️ Without this, the single most common hero on a Japanese clinic site — a full-width photograph
 * set as `background-image` on a class — is invisible to the importer, and every such site gets read
 * as "no picture, centred text". The class NAME is never interpreted; all that is asked is whether a
 * rule mentioning it paints a picture, which is as true of `.p-mv` as of `.hero__bg`. */
function backgroundImageClasses(css: string): Set<string> {
  const classes = new Set<string>();
  let rules = 0;
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (rules++ > MAX_CSS_RULES) break;
    if (!/background(?:-image)?\s*:[^;]*url\(/i.test(match[2])) continue;
    for (const cls of match[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(cls[1]);
  }
  return classes;
}

/** Whether anything inside `scope` actually shows a picture — an element, an inline background, or a
 * class the stylesheet paints one onto. */
function hasPaintedImage($: CheerioAPI, scope: Scope, painted: Set<string>): boolean {
  if (scope.find("img,picture,video,[style*=background-image]").length > 0) return true;
  if (painted.size === 0) return false;

  let found = false;
  let probed = 0;
  scope
    .add(scope.find("[class]"))
    .each((_, el) => {
      if (probed++ > MAX_CLASS_PROBE) return false;
      const classes = ($(el).attr("class") ?? "").split(/\s+/);
      if (classes.some((name) => painted.has(name))) {
        found = true;
        return false;
      }
    });
  return found;
}

// --- nav -----------------------------------------------------------------------------------------

/** Tried in order; the first list that looks like a site nav wins. A page with `header nav` almost
 * always means it, whereas bare `nav a` also matches breadcrumbs and footer menus. */
const NAV_SELECTORS = ["header nav a", "nav a", "[role=navigation] a", "header ul a"];

/** `/about/`, `/about/index.html`, `https://host/about` -> `/about`. Home -> `""`. */
function normalizePathname(href: string, pageUrl: string): string | null {
  try {
    const url = new URL(href, pageUrl);
    const base = new URL(pageUrl);
    if (url.origin !== base.origin) return null;
    let pathname = url.pathname.replace(/\/index\.html?$/i, "/").replace(/\/+$/, "");
    if (pathname === "/") pathname = "";
    return pathname;
  } catch {
    return null;
  }
}

function collectNav($: CheerioAPI, pageUrl: string): StructureNavItem[] {
  for (const selector of NAV_SELECTORS) {
    const items: StructureNavItem[] = [];
    const seen = new Set<string>();
    let offSite = 0;
    let total = 0;

    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (!href || /^(tel:|mailto:|javascript:)/i.test(href)) return;
      const label = $(el).text().replace(/\s+/g, " ").trim();
      if (label.length === 0 || label.length > NAV_LABEL_MAX) return;
      if (NON_CONTENT_NAV.test(label)) return;

      total++;
      // A fragment link is same-page by definition — the evidence that this is a one-pager.
      const pathname = href.startsWith("#") ? "" : normalizePathname(href, pageUrl);
      if (pathname === null) {
        offSite++;
        return;
      }
      const key = `${label}|${pathname}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ label, pathname, depth: pathname.split("/").filter(Boolean).length });
    });

    // Too few and it is a logo plus a phone number; too many and it is a sitemap block in the footer.
    if (items.length < 3 || items.length > 15) continue;
    if (total > 0 && offSite / total > 1 - AGREEMENT) continue;
    return items;
  }
  return [];
}

// --- sections ------------------------------------------------------------------------------------

function classifyHeading(heading: string): BlockType | null {
  for (const { kind, pattern } of SECTION_KEYWORDS) {
    if (pattern.test(heading)) return kind;
  }
  return null;
}

/** The largest group of sibling elements that repeat the same shape — the reference site's cards.
 *
 * ⚠️ Class NAMES are never matched against a list. What is checked is that the siblings share one
 * class string as each other, which is true of `.p-card`, `.elementor-column` and `.col-md-4` alike
 * and needs no knowledge of the framework that produced them. */
function detectCards($: CheerioAPI, scope: Scope): { count: number; withImages: boolean } {
  let best = { count: 0, withImages: false };
  let scanned = 0;

  const candidates = scope.find("*").add(scope);
  candidates.each((_, el) => {
    if (scanned++ > MAX_CARD_SCAN) return false;
    const children = $(el).children();
    const n = children.length;
    if (n < CARD_GROUP.min || n > CARD_GROUP.max || n <= best.count) return;

    const tags = children.map((_, c) => tagName(c)).get();
    if (tags.filter((t) => t === tags[0]).length / n < AGREEMENT) return;

    const classes = children.map((_, c) => $(c).attr("class") ?? "").get();
    if (classes.filter((c) => c === classes[0]).length / n < AGREEMENT) return;

    let titled = 0;
    let withImage = 0;
    children.each((_, c) => {
      const child = $(c);
      // A card says something. A row of icons or spacer divs does not.
      if (child.find("h2,h3,h4,h5,strong,p").first().text().trim().length >= 4) titled++;
      if (child.find("img,picture").length > 0) withImage++;
    });
    if (titled / n < AGREEMENT) return;

    best = { count: n, withImages: withImage / n >= AGREEMENT };
  });

  return best;
}

function describeSection(
  $: CheerioAPI,
  heading: string,
  level: number,
  scope: Scope,
  painted: Set<string>
): StructureSection {
  const kind = classifyHeading(heading);
  const cards = detectCards($, scope);
  return {
    kind,
    unmatchedHeading: kind === null ? heading.slice(0, 16) : "",
    level,
    hasImage: hasPaintedImage($, scope, painted),
    cardCount: cards.count,
    cardsHaveImages: cards.withImages,
    hasTable: scope.find("table").length > 0,
    hasList: scope.find("dl").length > 0 || scope.find("li").length >= 3,
    textLength: textLength(scope),
  };
}

function headingOf($: CheerioAPI, scope: Scope): { text: string; level: number } | null {
  const heading = scope.find("h1,h2,h3,h4").first();
  if (heading.length === 0) return null;
  const text = heading.text().replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  return { text, level: Number(tagName(heading[0]).slice(1)) || 2 };
}

function collectSections($: CheerioAPI, painted: Set<string>): StructureSection[] {
  const root = $("main").length > 0 ? $("main").first() : $("body").first();

  // A real <section> list is the best evidence there is, so it is tried first — but only when the
  // sections are LEAVES. A page that wraps everything in one outer <section> would otherwise report
  // a single section containing the whole site.
  const sections = root
    .find("section")
    .filter((_, el) => $(el).find("section").length === 0 && headingOf($, $(el)) !== null);

  const found: StructureSection[] = [];
  if (sections.length >= 3) {
    sections.each((_, el) => {
      if (found.length >= MAX_SECTIONS) return false;
      const scope = $(el);
      const heading = headingOf($, scope);
      if (heading) found.push(describeSection($, heading.text, heading.level, scope, painted));
    });
  } else {
    // No usable <section> markup — walk the headings and treat everything up to the next heading of
    // the same or higher rank as that heading's section. `nextUntil` is exactly this operation.
    root.find("h2,h3").each((_, el) => {
      if (found.length >= MAX_SECTIONS) return false;
      const headingEl = $(el);
      const text = headingEl.text().replace(/\s+/g, " ").trim();
      if (text.length === 0) return;
      const scope = headingEl.nextUntil("h1,h2,h3").add(headingEl);
      found.push(describeSection($, text, Number(tagName(el).slice(1)) || 2, scope, painted));
    });
  }

  // Navigation blocks, breadcrumbs and banner strips all parse as "a heading with nothing under it".
  return found.filter((s) => s.textLength >= 20 || s.hasImage);
}

// --- hero / header / footer ----------------------------------------------------------------------

/** The opening block: the smallest region that still contains the page's first heading.
 *
 * ⚠️ Not "the first child of `main`". That is a wrapper `<div>` on most page builders — sometimes one
 * holding the entire page, sometimes an empty spacer — and both readings produce a confident, wrong
 * answer. Walking up from the heading and stopping before the region swallows the page finds the
 * band the heading actually sits in, whatever it is called. */
function heroRootOf($: CheerioAPI): Scope {
  const root = $("main").length > 0 ? $("main").first() : $("body").first();
  const heading = root.find("h1,h2").first();
  if (heading.length === 0) return root.children().not("header,nav,script,style,noscript").first();

  const total = Math.max(1, textLength(root));
  let best: Scope = heading;
  let node: Scope = heading.parent();
  while (node.length > 0 && !node.is("body,main,html")) {
    if (textLength(node) > total * HERO_TEXT_SHARE) break;
    best = node;
    node = node.parent();
  }
  return best;
}

function detectHero($: CheerioAPI, painted: Set<string>): StructureSignals["heroForm"] {
  const heroRoot = heroRootOf($);
  if (heroRoot.length === 0) return "none";

  const inlineImage = heroRoot.find("img,picture").first();
  if (!hasPaintedImage($, heroRoot, painted)) {
    return textLength(heroRoot) > 0 ? "centered" : "none";
  }
  // A background image cannot sit beside anything — the words are on top of it.
  if (inlineImage.length === 0) return "full-bleed";

  // Two columns, one holding the picture and one holding the words, is what "split" means. Anything
  // else with a photograph in it reads as a photograph with text over it.
  const columns = heroRoot.children().not("script,style");
  if (columns.length === 2) {
    const withImage = columns.filter((_, el) => $(el).find("img,picture").length > 0).length;
    const withText = columns.filter((_, el) => textLength($(el)) >= 8).length;
    if (withImage === 1 && withText >= 1) return "split";
  }
  return "full-bleed";
}

function detectHeader($: CheerioAPI): StructureSignals["headerForm"] {
  const header = $("header").first().length > 0 ? $("header").first() : $("[role=banner]").first();
  if (header.length === 0) return "bar";
  const links = header.find("a").filter((_, el) => !/^(tel:|mailto:)/i.test($(el).attr("href") ?? "")).length;
  const hasTel = header.find("a[href^='tel:']").length > 0;
  // A header with a logo, maybe one link and no phone number is a masthead, not a navigation bar.
  return links <= 2 && !hasTel ? "minimal" : "bar";
}

/** The declared background of `footer` / `.footer` / `#footer`, read out of the CSS text we already
 * fetched. Deliberately last-wins: later rules override earlier ones in the cascade, and specificity
 * is not worth modelling for one property. */
function footerBackground(css: string): string | null {
  let found: string | null = null;
  for (const match of css.matchAll(/([^{}]*\bfooter\b[^{}]*)\{([^}]*)\}/gi)) {
    const selector = match[1];
    // `.footer-nav a` is inside the footer but is not the footer.
    if (/[.#]?footer[\w-]+/i.test(selector) || /\s+[a-z]/i.test(selector.trim().replace(/^[.#]?footer/i, ""))) continue;
    const background = match[2].match(/background(?:-color)?\s*:\s*([^;]+)/i);
    if (!background) continue;
    const color = normalizeColor(background[1].split(/\s+/)[0]);
    if (color) found = color;
  }
  return found;
}

function detectFooter($: CheerioAPI, css: string): StructureSignals["footerForm"] {
  const footer = $("footer").first();
  if (footer.length === 0) return "dark";

  const declared = footerBackground(css) ?? normalizeColor((footer.attr("style") ?? "").match(/background(?:-color)?\s*:\s*([^;]+)/i)?.[1] ?? "");
  if (declared) {
    const rgb = hexToRgb(declared);
    // The colour is the dominant impression, so it decides even for a short footer — "compact" is a
    // shape and the enum cannot carry both. The model sees the same evidence and may overrule.
    if (rgb) return luminance(rgb) < 0.4 ? "dark" : "light";
  }
  return textLength(footer) < 120 && footer.find("h1,h2,h3,h4").length === 0 ? "compact" : "dark";
}

// --- entry point ---------------------------------------------------------------------------------

export function extractStructure($: CheerioAPI, css: string, pageUrl: string): StructureSignals {
  const navItems = collectNav($, pageUrl);
  const distinctPages = navItems.length === 0 ? 1 : new Set(navItems.map((i) => i.pathname)).size;
  const painted = backgroundImageClasses(css);

  return {
    navItems,
    sections: collectSections($, painted),
    heroForm: detectHero($, painted),
    headerForm: detectHeader($),
    footerForm: detectFooter($, css),
    distinctPages: Math.min(distinctPages, 8),
  };
}

const KIND_LABELS: Record<BlockType, string> = {
  hero: "メインビジュアル",
  rich: "文章＋カード",
  hours: "診療時間",
  access: "アクセス",
  news: "お知らせ",
  staff: "スタッフ紹介",
  faq: "よくある質問",
  pricing: "料金表",
  contact: "お問い合わせ",
  freeText: "自由文",
  imageBanner: "画像バナー",
  gallery: "ギャラリー",
};

/** Model-readable rendering, in the same prose style as describeSignals. */
export function describeStructure(structure: StructureSignals): string {
  const lines: string[] = ["", "## 参考サイトのページ構成"];

  lines.push(
    structure.distinctPages <= 1
      ? "- ナビゲーションのリンクはすべて同じページ内。1枚もの（1ページ構成）のサイト。"
      : `- ナビゲーションから見えるページ数: 約${structure.distinctPages}ページ`
  );
  if (structure.navItems.length > 0) {
    const depth = Math.max(...structure.navItems.map((i) => i.depth));
    lines.push(`- ナビゲーションの項目数: ${structure.navItems.length}／最大の階層の深さ: ${depth}`);
  }
  lines.push(
    `- ヘッダーの形: ${structure.headerForm === "minimal" ? "ロゴ中心で項目が少ない" : "横並びのバー"}`,
    `- フッターの形: ${structure.footerForm === "dark" ? "濃い色地" : structure.footerForm === "light" ? "明るい地" : "情報の少ない小さなフッター"}`,
    `- 冒頭（ヒーロー）の形: ${
      { "full-bleed": "大きな画像に文字を重ねる", split: "画像と文字が左右", centered: "画像なしで文字が中央", none: "大きな導入部がない" }[
        structure.heroForm
      ]
    }`
  );

  if (structure.sections.length > 0) {
    lines.push("", "## 参考サイトのセクション（上から順）");
    for (const [index, section] of structure.sections.entries()) {
      const parts: string[] = [];
      parts.push(section.kind ? `${KIND_LABELS[section.kind]}らしい` : `分類できない見出し「${section.unmatchedHeading}」`);
      if (section.cardCount > 0) {
        parts.push(`同じ形の項目が${section.cardCount}個${section.cardsHaveImages ? "（写真つき）" : "（写真なし）"}`);
      }
      if (section.hasTable) parts.push("表がある");
      else if (section.hasList) parts.push("箇条書きがある");
      if (section.hasImage && section.cardCount === 0) parts.push("写真がある");
      parts.push(`本文${section.textLength}文字`);
      lines.push(`${index + 1}. ${parts.join(" / ")}`);
    }
  }

  return lines.join("\n");
}
