import { z } from "zod";

/** SiteDocument is the single shape behind BOTH a design template and a generated clinic site — the
 * only thing separating them is `isTemplate`. That equality is deliberate and load-bearing: it means
 * one renderer produces both (so a template's preview is pixel-identical to the site it will
 * produce), one editor screen edits both, and "make a site from a template" is a plain clone plus a
 * content swap rather than a separate code path.
 *
 * It also replaces the old two-value design knobs (hp-templates/presets/*.json's
 * `fontFamily: "sans" | "serif"`, `cardStyle: "rounded" | "sharp"`) with concrete values, because
 * design tokens extracted from an arbitrary reference URL cannot be forced into a fixed enum. */

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "色は #rrggbb 形式で指定してください。");

// --- design tokens -------------------------------------------------------------------------------

export const designTokensSchema = z.object({
  colors: z.object({
    primary: hexColor,
    accent: hexColor,
    /** Pale tint of `primary`, used for alternating section backgrounds. */
    light: hexColor,
    background: hexColor,
    text: hexColor,
    /** Text color that sits on top of `primary` / `accent` — kept explicit rather than computed so a
     * template importer can honour what the reference site actually did. */
    primaryInverse: hexColor,
    accentInverse: hexColor,
  }),
  font: z.object({
    headingFamily: z.string().min(1),
    bodyFamily: z.string().min(1),
    /** Google Fonts family names to emit a <link> for, e.g. ["Noto Sans JP:wght@400;700"]. Empty
     * means system fonts only — no external request from the generated page. */
    googleFonts: z.array(z.string()),
    baseSize: z.number().min(12).max(22),
    lineHeight: z.number().min(1.2).max(2.4),
    headingWeight: z.number().int().min(300).max(900),
  }),
  block: z.object({
    radius: z.number().min(0).max(48),
    borderWidth: z.number().min(0).max(4),
    borderColor: hexColor,
    shadow: z.enum(["none", "soft", "strong"]),
    /** The biggest structural lever a template has. "minimal" renders no card image at all, which is
     * why image generation must consult it (see buildImageJobs) rather than leaving it to CSS. */
    cardLayout: z.enum(["grid", "list", "minimal", "overlap"]),
  }),
  layout: z.object({
    heroLayout: z.enum(["full-bleed", "split", "centered"]),
    maxWidth: z.number().min(880).max(1440),
    spacingScale: z.number().min(0.7).max(2),
    sectionDivider: z.enum(["none", "wave", "diagonal"]),
  }),
  animation: z.object({
    reveal: z.enum(["none", "fade", "slide-up", "zoom"]),
    /** Milliseconds. 0 with reveal "none" means the page ships with no motion at all. */
    duration: z.number().min(0).max(2000),
    stagger: z.boolean(),
    parallaxHero: z.boolean(),
  }),
});

export type DesignTokens = z.infer<typeof designTokensSchema>;

/** Matches the `:root` fallbacks in src/lib/render/site.css. Used when a URL import can't determine a
 * value and as the starting point for a hand-made template. */
export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: "#4ba3fc",
    accent: "#2d7dd2",
    light: "#e8f4ff",
    background: "#ffffff",
    text: "#2b2b2b",
    primaryInverse: "#ffffff",
    accentInverse: "#ffffff",
  },
  font: {
    headingFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
    bodyFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
    googleFonts: [],
    baseSize: 16,
    lineHeight: 1.8,
    headingWeight: 700,
  },
  block: {
    radius: 12,
    borderWidth: 1,
    borderColor: "#eeeeee",
    shadow: "soft",
    cardLayout: "grid",
  },
  layout: {
    heroLayout: "full-bleed",
    maxWidth: 1080,
    spacingScale: 1,
    sectionDivider: "none",
  },
  animation: {
    reveal: "slide-up",
    duration: 700,
    stagger: true,
    parallaxHero: false,
  },
};

// --- per-block data ------------------------------------------------------------------------------

export const heroDataSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  image: z.string(),
});

export const richDataSchema = z.object({
  heading: z.string(),
  body: z.string(),
  /** A section-level image renders as a side-by-side split; per-card images render in whatever
   * `design.block.cardLayout` chose. */
  image: z.string().optional(),
  cards: z.array(z.object({ heading: z.string(), body: z.string(), image: z.string().optional() })),
});

export const hoursDataSchema = z.object({
  heading: z.string(),
  rows: z.array(z.object({ label: z.string(), value: z.string() })),
  note: z.string().optional(),
});

export const accessDataSchema = z.object({
  heading: z.string(),
  address: z.string(),
  /** URL-encoded query for the embedded map. Derived from `address` on generation, but editable
   * separately because the postal address and the map pin don't always agree. */
  mapQuery: z.string(),
  note: z.string().optional(),
});

export const newsDataSchema = z.object({
  heading: z.string(),
  items: z.array(z.object({ date: z.string(), title: z.string(), body: z.string().optional() })),
});

export const staffDataSchema = z.object({
  heading: z.string(),
  members: z.array(
    z.object({
      name: z.string(),
      role: z.string().optional(),
      comment: z.string(),
      image: z.string().optional(),
    })
  ),
});

export const faqDataSchema = z.object({
  heading: z.string(),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export const pricingDataSchema = z.object({
  heading: z.string(),
  items: z.array(z.object({ name: z.string(), price: z.string(), note: z.string().optional() })),
  note: z.string().optional(),
});

export const contactDataSchema = z.object({
  heading: z.string(),
  lead: z.string(),
});

export const freeTextDataSchema = z.object({
  heading: z.string(),
  body: z.string(),
  align: z.enum(["left", "center"]),
});

export const imageBannerDataSchema = z.object({
  image: z.string(),
  caption: z.string().optional(),
  href: z.string().optional(),
  height: z.enum(["short", "tall"]),
});

export const galleryDataSchema = z.object({
  heading: z.string(),
  images: z.array(z.object({ src: z.string(), caption: z.string().optional() })),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

// --- block ---------------------------------------------------------------------------------------

/** Every block carries a unique instance `id` rather than being keyed by its type. That is what lets
 * the same type appear more than once on a page (two "文章＋カード" sections, say) — the old
 * SITE_SPEC model keyed sections by type id and so capped each at one. Anchors/nav links use this id. */
const blockCommon = {
  id: z.string().min(1),
  visible: z.boolean(),
  /** Label shown in the page's nav. Empty string means "render the block but keep it out of the nav"
   * — correct for hero and for decorative banners. */
  navLabel: z.string(),
};

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockCommon, type: z.literal("hero"), data: heroDataSchema }),
  z.object({ ...blockCommon, type: z.literal("rich"), data: richDataSchema }),
  z.object({ ...blockCommon, type: z.literal("hours"), data: hoursDataSchema }),
  z.object({ ...blockCommon, type: z.literal("access"), data: accessDataSchema }),
  z.object({ ...blockCommon, type: z.literal("news"), data: newsDataSchema }),
  z.object({ ...blockCommon, type: z.literal("staff"), data: staffDataSchema }),
  z.object({ ...blockCommon, type: z.literal("faq"), data: faqDataSchema }),
  z.object({ ...blockCommon, type: z.literal("pricing"), data: pricingDataSchema }),
  z.object({ ...blockCommon, type: z.literal("contact"), data: contactDataSchema }),
  z.object({ ...blockCommon, type: z.literal("freeText"), data: freeTextDataSchema }),
  z.object({ ...blockCommon, type: z.literal("imageBanner"), data: imageBannerDataSchema }),
  z.object({ ...blockCommon, type: z.literal("gallery"), data: galleryDataSchema }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
/** Narrows a Block to one variant, e.g. `BlockOf<"faq">`. */
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const BLOCK_TYPES: BlockType[] = [
  "hero",
  "rich",
  "hours",
  "access",
  "news",
  "staff",
  "faq",
  "pricing",
  "contact",
  "freeText",
  "imageBanner",
  "gallery",
];

/** Short, collision-resistant instance id. Not a UUID: it lands in the generated page as an HTML
 * anchor (`#blk_a1b2c3`), so brevity is worth more here than global uniqueness. */
export function newBlockId(): string {
  return `blk_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

// --- site meta + document ------------------------------------------------------------------------

export const siteMetaSchema = z.object({
  clinicName: z.string(),
  phone: z.string(),
  line: z.string(),
  address: z.string(),
  logoImage: z.string(),
  seo: z.object({
    title: z.string(),
    metaDescription: z.string(),
    ogTitle: z.string(),
    ogDescription: z.string(),
    ogSiteName: z.string(),
  }),
  snsLinks: z.array(z.object({ label: z.string(), href: z.string() })),
});

export type SiteMeta = z.infer<typeof siteMetaSchema>;

export const siteDocumentSchema = z.object({
  id: z.string().min(1),
  /** Output directory name under public/generated, and the Cloudflare Pages project name. ASCII only. */
  slug: z.string().min(1),
  name: z.string().min(1),
  isTemplate: z.boolean(),
  /** Templates only: whether this template is offered to the auto-selector. */
  canSell: z.boolean(),
  templateId: z.string().optional(),
  ownerEmail: z.string().optional(),
  design: designTokensSchema,
  meta: siteMetaSchema,
  blocks: z.array(blockSchema),
  /** Templates only: prose describing the atmosphere. This is what selectTemplate.ts shows the model,
   * so it must read as mood ("落ち着いた和モダン、年配の患者向け") and never as markup. */
  mood: z.string().optional(),
  tags: z.array(z.string()),
  sourceUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SiteDocument = z.infer<typeof siteDocumentSchema>;

/** Visible blocks that asked to appear in the nav, in document order. Both the page's own <nav> and
 * its footer link list derive from this, so they can never disagree. */
export function navBlocks(doc: SiteDocument): { id: string; label: string }[] {
  return doc.blocks
    .filter((b) => b.visible && b.navLabel.trim().length > 0)
    .map((b) => ({ id: b.id, label: b.navLabel }));
}
