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
    /** Multiplies heading sizes only, leaving body text alone. A design that carries its impact in
     * type rather than in photographs needs the headings to be genuinely large; scaling `baseSize`
     * instead would just make the whole page bigger, which is not the same thing.
     *
     * .default() is load-bearing here, as it is for every field added after the first sites were
     * written — see the note on layout.background below. */
    displayScale: z.number().min(1).max(2.2).default(1),
    /** Heading letter-spacing in em. Japanese headings set with generous tracking are most of what
     * separates "洗練" from "普通" in a text-led layout, and it cannot be derived from the family. */
    headingLetterSpacing: z.number().min(-0.02).max(0.3).default(0),
  }),
  block: z.object({
    radius: z.number().min(0).max(48),
    borderWidth: z.number().min(0).max(4),
    borderColor: hexColor,
    shadow: z.enum(["none", "soft", "strong"]),
    /** The biggest structural lever a template has. "minimal" renders no card image at all, which is
     * why image generation must consult it (see buildImageJobs) rather than leaving it to CSS. */
    cardLayout: z.enum(["grid", "list", "minimal", "overlap"]),
    /** Multiplies the CTA buttons' padding and label size. 1 is the size every site shipped with
     * before this field existed, so a template that says nothing is unchanged.
     *
     * A separate knob from `font.baseSize` on purpose: how loud the 電話 / LINE buttons are is a
     * decision about the page's call to action, not about its reading size. A quiet editorial layout
     * wants small buttons at a normal reading size; a 集患 landing page wants the opposite. */
    buttonScale: z.number().min(0.8).max(1.8).default(1),
  }),
  layout: z.object({
    heroLayout: z.enum(["full-bleed", "split", "centered"]),
    maxWidth: z.number().min(880).max(1440),
    spacingScale: z.number().min(0.7).max(2),
    sectionDivider: z.enum(["none", "wave", "diagonal"]),
    /** Page-wide background treatment. "plain" is the original flat white / pale-tint alternation;
     * the rest add texture so the page doesn't read as a stack of identical white boxes.
     *
     * .default() is load-bearing, not tidiness: getDocument() runs safeParse over the stored JSON and
     * falls back to DEFAULT_DESIGN_TOKENS *in full* when it fails. A newly-required field would make
     * every document written before this change fail that parse and silently lose its real colours
     * and fonts. With a default, old JSON still parses and simply arrives with the feature off. */
    background: z.enum(["plain", "gradient", "blobs", "dots", "grid"]).default("plain"),
    /** Ornament level: section numbers, heading marks, corner shapes. Purely decorative — nothing
     * here changes what the page says, only how furnished it looks. */
    decoration: z.enum(["none", "accent", "rich"]).default("none"),
    /** How one section is separated from the next when there is no photograph to do it. "hairline"
     * is a thin rule and a lightened heading; "accent-bar" moves the emphasis to a coloured bar
     * beside the heading. Both replace the default heavy underline under every h2, which is what
     * makes a photo-light page read as a form rather than as a design. */
    rule: z.enum(["none", "hairline", "accent-bar"]).default("none"),
    /** A pattern drawn with CSS and an inline SVG mask — no file, no request, and it follows the
     * theme colour because the SVG is a MASK over `var(--primary)` rather than a picture.
     *
     * ⚠️ Deliberately orthogonal to `background` above. That one paints the whole page (`body`);
     * this one is per section, sits inside the section's own `overflow-x: clip` box, and is what an
     * "動きのある・飾りのある" template is built from. */
    ornament: z.enum(["none", "seigaiha", "asanoha", "dots-fine", "hairlines", "arc"]).default("none"),
    /** How visible the pattern is. 0 is invisible, 1 is the brand colour at full strength.
     *
     * ⚠️ The default is low on purpose, and it is low because it was measured rather than guessed:
     * at 0.3 the pattern is the strongest thing on the page and the cards float on top of wallpaper.
     * A 地紋 is meant to be noticed second, not first. */
    ornamentStrength: z.number().min(0).max(1).default(0.16),
    /** A generated photograph behind the page. "page" puts it behind everything, "sections" only
     * behind the tinted sections.
     *
     * ⚠️ Always under a scrim of `--bg` (see site.css). `checkContrast` compares TOKENS, so it
     * cannot see text sitting on a photograph; keeping the effective background at the token colour
     * is what lets the existing check stay correct instead of silently becoming a lie. */
    backdrop: z.enum(["none", "page", "sections"]).default("none"),
    /** Filled by the image pipeline, like every other image path in the document — see
     * BACKDROP_SLOT in site/imagePaths.ts. Empty means the backdrop renders as nothing at all. */
    backdropImage: z.string().default(""),
    /** The name of a style kit — one template's own CSS and JS, held in the repository under
     * `src/lib/render/kits/`. Empty (the default) is the plain page every site rendered as before
     * kits existed.
     *
     * ⚠️ A NAME, never the code. That distinction is the whole security model: see the header of
     * `src/lib/render/kits/index.ts`. A key naming no kit resolves to nothing, exactly as an
     * unrecognised `variant` falls back to the template's own layout. */
    styleKit: z.string().default(""),
  }),
  /** The header and footer — the two regions that are not blocks and so have no per-block variant.
   *
   * Both had exactly one hardcoded form until now, and the footer's colours were literal hex values
   * in site.css with no token behind them at all. The first value of each enum reproduces that form
   * exactly, so an existing template is unchanged by their arrival. */
  chrome: z
    .object({
      /** ⚠️ No "overlay" (transparent header on top of the hero). `nav.site-nav` is a SIBLING of the
       * header, not a child — the CSS-only hamburger needs `.nav-toggle:checked ~ nav.site-nav`,
       * which only matches between elements sharing a parent. Lifting just the header out of flow
       * therefore strands the coloured nav bar at the top of the hero, and lifting both requires a
       * wrapper that breaks the mobile menu on every page of every site. It is doable, but it needs
       * markup and JS changes rather than a CSS variant, so it is not one of these. */
      header: z.enum(["bar", "stacked", "minimal"]).default("bar"),
      footer: z.enum(["dark", "light", "compact", "band"]).default("dark"),
    })
    .default(() => ({ header: "bar" as const, footer: "dark" as const })),
  animation: z.object({
    reveal: z.enum(["none", "fade", "slide-up", "slide-left", "slide-right", "zoom", "pop", "flip", "blur"]),
    /** Milliseconds. 0 with reveal "none" means the page ships with no motion at all. */
    duration: z.number().min(0).max(2000),
    stagger: z.boolean(),
    parallaxHero: z.boolean(),
    /** Cycles the reveal direction and the card arrangement across consecutive sections, so a long
     * page doesn't repeat one identical entrance a dozen times. `reveal` above stays the base.
     * Defaulted for the same back-compat reason as layout.background. */
    variety: z.boolean().default(false),
    /** Motion that never stops, on the decorative layer only.
     *
     * ⚠️ It only ever moves `.ornament` — an element that is `position: absolute; inset: 0;
     * pointer-events: none` inside a box with `overflow-x: clip`. That is not a style choice: it is
     * what makes it impossible for a decoration to reintroduce the 390px horizontal-scroll bug, or
     * to sit on top of a link. Nothing here may move a box that holds text.
     *
     * ⚠️ Every rule that reads this is prefixed `html:not([data-reveal="none"])`. A template that
     * opted out of motion opted out of ALL of it, and ambient motion is the easiest place to
     * forget that. */
    ambient: z.enum(["none", "drift", "float", "sheen"]).default("none"),
    /** A thin bar across the top showing how far down the page the reader is. */
    progressBar: z.boolean().default(false),
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
    displayScale: 1,
    headingLetterSpacing: 0,
  },
  block: {
    radius: 12,
    borderWidth: 1,
    borderColor: "#eeeeee",
    shadow: "soft",
    cardLayout: "grid",
    buttonScale: 1,
  },
  layout: {
    heroLayout: "full-bleed",
    maxWidth: 1080,
    spacingScale: 1,
    sectionDivider: "none",
    background: "plain",
    decoration: "none",
    rule: "none",
    ornament: "none",
    ornamentStrength: 0.16,
    backdrop: "none",
    backdropImage: "",
    styleKit: "",
  },
  chrome: {
    header: "bar",
    footer: "dark",
  },
  animation: {
    reveal: "slide-up",
    duration: 700,
    stagger: true,
    parallaxHero: false,
    variety: false,
    ambient: "none",
    progressBar: false,
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

// --- per-field text style + per-block spacing overrides -------------------------------------------

/** A "field path" addresses one editable value inside a block's `data`: the bare key for a top-level
 * field ("heading"), or "<listKey>.<index>.<subKey>" for one item inside a list field ("cards.1.heading")
 * — the same indexing ListEditor already uses for array items. This is the join key between the visual
 * editor's click target (a `data-field` attribute, see components.tsx) and `Block.textStyles`. */
const fieldPathPattern = /^[a-zA-Z][a-zA-Z0-9]*(\.\d+\.[a-zA-Z][a-zA-Z0-9]*)?$/;

/** Per-field font/color override, written by the visual editor's right-hand panel. Absent (the common
 * case) means "inherit the document's global `design.font`/`design.colors.text`" — this is deliberately
 * a small, flat set of properties rather than rich text, because block `data` is plain strings with no
 * run-level formatting anywhere in the render pipeline; adding that would need a different content model
 * entirely (see the plan this shipped under). */
export const textStyleSchema = z.object({
  color: hexColor.optional(),
  fontFamily: z.string().min(1).optional(),
  fontSize: z.number().min(10).max(96).optional(),
  fontWeight: z.number().int().min(300).max(900).optional(),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

/** Per-block spacing override. Deliberately block-scoped, not per-field: padding/margin around a single
 * clicked headline isn't a concept most users have, but "more space above/below this section" is exactly
 * what a page-builder's spacing controls mean. `paddingTop`/`paddingBottom` are ignored by the renderer
 * for `hero` and `imageBanner` (see components.tsx) — those two block types put their image directly in
 * the outer element's grid/flex box with no inner padded wrapper, so outer padding would inset the image
 * itself and break the edge-to-edge layout; margin is safe for all 12 types. */
export const blockSpacingSchema = z.object({
  paddingTop: z.number().min(0).max(200).optional(),
  paddingBottom: z.number().min(0).max(200).optional(),
  marginTop: z.number().min(0).max(200).optional(),
  marginBottom: z.number().min(0).max(200).optional(),
});
export type BlockSpacing = z.infer<typeof blockSpacingSchema>;

/** A "container path" addresses a *box* inside a block, as opposed to a text/image value:
 *   "section" — the block's outer <section>
 *   "inner"   — the padded content wrapper inside it (.section-inner)
 *   "card.<n>" — one card in a list-bearing block
 * The renderer stamps these onto the DOM as `data-container` (see components.tsx); the visual canvas
 * turns the same attribute into a click target. Kept separate from field paths on purpose — a field
 * holds a value the user types, a container holds only presentation. */
const containerPathPattern = /^(section|inner|card\.\d+)$/;

/** Per-container colour/padding/margin override. `background` and `color` are what a field-level
 * TextStyle can't express: they belong to the box, not to one run of text.
 *
 * For the "section" container, padding and margin live in the block's own `spacing` instead of here —
 * that field predates this one and is already wired through the renderer and `blockSupportsPadding`,
 * so reusing it avoids both a migration and two sources of truth for the same two numbers. */
export const containerStyleSchema = z.object({
  background: hexColor.optional(),
  color: hexColor.optional(),
  paddingTop: z.number().min(0).max(200).optional(),
  paddingBottom: z.number().min(0).max(200).optional(),
  paddingLeft: z.number().min(0).max(200).optional(),
  paddingRight: z.number().min(0).max(200).optional(),
  marginTop: z.number().min(0).max(200).optional(),
  marginBottom: z.number().min(0).max(200).optional(),
});
export type ContainerStyle = z.infer<typeof containerStyleSchema>;

// --- page ----------------------------------------------------------------------------------------

/** The home page's id. Blocks written before multi-page rendering have no stored page and default
 * to it, which is how every existing one-page site keeps rendering unchanged. */
export const HOME_PAGE_ID = "home";

/** Reserved output names. A page claiming one of these would collide with a directory or a file that
 * renderSiteFiles writes itself, or with a Cloudflare Pages control file. */
export const RESERVED_PAGE_PATHS = new Set(["index", "css", "js", "images", "_headers", "_redirects", "404"]);

export const pageSchema = z.object({
  /** Stable identity, referenced by `Block.pageId`. Never appears in a URL, so renaming a page's
   * `path` cannot orphan its blocks. */
  id: z.string().min(1),
  /** The URL segment, without an extension. `""` is the home page and renders as `index.html`.
   *
   * ⚠️ That is a constraint rather than a convention: `generatedSiteExists`/`generatedSlugExists`
   * (renderSiteFiles.ts), `importFromGeneratedSite` and the design-check script all key on
   * `<outDir>/index.html`, and no already-published site's URL may change. */
  path: z.string().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  navLabel: z.string(),
  /** Empty falls back to `meta.seo.title` / `meta.seo.metaDescription`. */
  title: z.string().default(""),
  metaDescription: z.string().default(""),
  inNav: z.boolean().default(true),
});
export type PageDef = z.infer<typeof pageSchema>;

/** A brand-new `pages` array. Returned from a function, not shared as a constant — `z.default()`
 * hands the SAME value to every parse, and a shared mutable array would let one document's page
 * edits appear in another's. */
export function defaultPages(): PageDef[] {
  return [{ id: HOME_PAGE_ID, path: "", navLabel: "ホーム", title: "", metaDescription: "", inNav: true }];
}

// --- block ---------------------------------------------------------------------------------------

/** Every block carries a unique instance `id` rather than being keyed by its type. That is what lets
 * the same type appear more than once on a page (two "文章＋カード" sections, say) — the old
 * SITE_SPEC model keyed sections by type id and so capped each at one. Anchors/nav links use this id. */
const blockCommon = {
  id: z.string().min(1),
  /** Which page this block renders on (see `pageSchema`). Defaults rather than being optional, so
   * every reader gets a real value and no `?? HOME_PAGE_ID` is scattered through the renderer, the
   * editor and the checks.
   *
   * ⚠️ The default is what keeps every document written before multi-page rendering working: their
   * blocks have no stored page and so all land on the home page, which is exactly where they were.
   * A block naming a page that does not exist would render on NO page — see normalizePages. */
  pageId: z.string().default(HOME_PAGE_ID),
  visible: z.boolean(),
  /** A photograph behind THIS section, under a scrim. Empty (the default, and what every block
   * written before this field has) means the section paints as it always did.
   *
   * ⚠️ Deliberately a block field rather than a `containerStyles["section"]` entry. Two reasons, both
   * structural: `containerStyles` is pruned on save by `pruneOrphanedStyles` (a path that no longer
   * resolves to a real container is deleted), and every image in a document has to be reachable from
   * `documentImageSlots` — the single ledger that tells the pipeline what to generate and what to
   * write back. A field the ledger can walk is the only kind of image path this codebase supports.
   *
   * ⚠️ Filling this costs a billed image. `blockImageSlots` therefore only offers a slot for blocks
   * that already carry a non-empty value, exactly as BACKDROP_SLOT is gated on
   * `design.layout.backdrop !== "none"`. "Every section may have one" would mean "every section is
   * billed for one". */
  backgroundImage: z.string().default(""),
  /** How much of `--bg` is laid over that photograph. 1 hides it entirely; 0 shows it raw.
   *
   * ⚠️ The default is high on purpose. `checkContrast` compares TOKENS and so is structurally unable
   * to see text sitting on a photograph — the same blind spot `backdropCss` works around. Holding the
   * effective background near `--bg` is what keeps that check measuring the thing that is really
   * behind the words. Below about 0.6 the photograph starts to win, so a section set that low must
   * not carry body text. */
  backgroundScrim: z.number().min(0).max(1).default(0.72),
  /** Per-block layout override, chosen from a closed list this codebase owns (see
   * src/lib/site/composition.ts). It is what lets one template produce differently-shaped pages for
   * different clinics without anything outside that list ever reaching the renderer. A value that is
   * not in the list is ignored rather than rejected — the block simply renders in the template's own
   * layout, which is exactly what happened before this field existed. Hence a plain string here
   * rather than an enum: the vocabulary is per block TYPE, which zod cannot express in `blockCommon`,
   * and `effectiveCardLayout` / `effectiveHeroLayout` are the single place it is validated. */
  variant: z.string().optional(),
  /** How many repeating items this section is DESIGNED around — advisory, never what renders.
   *
   * ⚠️ `data.cards.length` is always what is drawn. This exists because a template has to know how
   * many cards to lay out before any content plan exists, which `data.cards.length` cannot answer
   * for a template whose cards are still sample copy. Exactly three places read it: applySampleCopy
   * (how many samples to fill a template with), sampleCardCount (the target shown to the planner),
   * and applyComposition (written back so a rebuild reproduces the shape). The renderer never does. */
  cardCount: z.number().int().min(2).max(6).optional(),
  /** Label shown in the page's nav. Empty string means "render the block but keep it out of the nav"
   * — correct for hero and for decorative banners. */
  navLabel: z.string(),
  spacing: blockSpacingSchema.optional(),
  /** Keyed by field path (see above). The regex is cheap defense-in-depth against garbage keys; it
   * can't know which paths are actually valid for a given block *type* (that needs BLOCK_DEFINITIONS,
   * see src/lib/site/blocks.ts's resolveFieldDefinition), so saveDocumentAction additionally prunes
   * keys that no longer resolve to a real field — see pruneOrphanedStyles in src/lib/site/fieldPath.ts. */
  textStyles: z.record(z.string().regex(fieldPathPattern), textStyleSchema).optional(),
  /** Keyed by container path (see containerPathPattern). Same defence-in-depth as `textStyles`, and
   * likewise pruned on save — a "card.7" entry is dead once the block only has three cards. */
  containerStyles: z.record(z.string().regex(containerPathPattern), containerStyleSchema).optional(),
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
  /** The LINE/tel CTA buttons' own label text (rendered by CtaButtons in hero AND contact — both
   * instances share these, since they're meant to say the same thing everywhere on the page). Was a
   * hard-coded literal in components.tsx before the visual editor could reach it; optional so existing
   * documents fall back to that same literal at render time (see components.tsx's CtaButtons). */
  ctaLineLabel: z.string().optional(),
  ctaTelLabel: z.string().optional(),
  /** The nav/footer's first "ホーム" link. Same optional-with-literal-fallback reasoning as above. */
  homeLabel: z.string().optional(),
});

export type SiteMeta = z.infer<typeof siteMetaSchema>;

/** Header/footer text styling and spacing — the two document-level fields below, named here so the
 * store can validate the `sites.chrome` blob they are persisted in without restating their shapes.
 *
 * They live outside `blocks` because the chrome is not a block: it has no block id for the visual
 * editor to address, so its overrides share one document-level record instead. */
const metaTextStylesSchema = z.record(z.string().regex(fieldPathPattern), textStyleSchema);
const chromeSpacingSchema = z.object({
  header: blockSpacingSchema.optional(),
  footer: blockSpacingSchema.optional(),
});

/** Shape of the `sites.chrome` column (migration 0005). Both members are optional and the whole blob
 * is optional, so a row written before that migration reads back as "no overrides" rather than as
 * corrupt — which is the same treatment `design` and `meta` already get in loadDocument. */
export const storedChromeSchema = z
  .object({
    metaTextStyles: metaTextStylesSchema.optional(),
    chromeSpacing: chromeSpacingSchema.optional(),
  })
  .partial();

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
  /** Same idea as a block's `textStyles`, but for the header/footer/CTA text that lives in `meta`
   * rather than in any block's `data` — those aren't addressed by a block id, so they share this one
   * document-level record instead. Keyed the same way ("clinicName", "snsLinks.0.label", ...) via the
   * "meta." path prefix the visual editor uses to tell a meta field apart from a block field — see
   * resolveSelectionField in src/lib/site/blocks.ts. */
  metaTextStyles: metaTextStylesSchema.optional(),
  /** Spacing for the header/footer chrome, which (unlike every block) isn't inside `blocks` at all —
   * this is where their spacing override lives instead. Same shape and same "unify with the
   * section/region as a whole" reasoning as a block's own `spacing`. */
  chromeSpacing: chromeSpacingSchema.optional(),
  /** The pages this document renders to. Always at least one; the first with `path: ""` is the home
   * page. See normalizePages for the invariants, which are enforced on read AND on write. */
  pages: z.array(pageSchema).default(defaultPages),
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
