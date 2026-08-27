import { BLOCK_DEFINITIONS, createBlock } from "@/lib/site/blocks";
import { archetypeBlocks, isArchetypeKey } from "@/lib/site/archetypes";
import { CARD_COUNT_RANGE, variantsFor } from "@/lib/site/composition";
import {
  BLOCK_TYPES,
  HOME_PAGE_ID,
  RESERVED_PAGE_PATHS,
  type Block,
  type BlockType,
  type PageDef,
} from "@/lib/site/document";

/** Turns a page/section plan the model proposed into pages and blocks that are safe to save.
 *
 * Same discipline as `normalizeDesignTokens` (importFromUrl.ts) and `normalizePages` (site/pages.ts):
 * it never throws, and every rule either accepts the model's value or falls back to one this codebase
 * owns. A structural suggestion is a proposal, not a fact — and a bad one must degrade to the layout
 * we shipped before, not to a broken template an admin has to delete.
 *
 * ⚠️ This is also the second of the five layers that keep a reference site's WORDS out of the result.
 * The first is the schema: there is nowhere in `AiBlockPlan` to put a sentence. The only free string
 * that reaches here is `navLabel`, and it must match a generic section name or it is replaced — a
 * clinic's name or a catchphrase cannot survive that. Body copy comes from `applySampleCopy`, images
 * are all `images/placeholder.svg`, and the prompt says so as well. */

/** What the model may propose. Loose on purpose (see the note on aiTemplateSchema): OpenAI's
 * structured outputs cannot express bounds, patterns or a per-type enum, so nothing is trusted. */
export type AiBlockPlan = {
  type: string;
  navLabel: string;
  variant: string | null;
  cardCount: number | null;
};

export type AiPagePlan = {
  path: string;
  navLabel: string;
  blocks: AiBlockPlan[];
};

const MAX_PAGES = 6;
const MAX_BLOCKS_PER_PAGE = 12;
const MAX_BLOCKS_TOTAL = 24;
const NAV_LABEL_MAX = 8;

/** The complete list of nav labels an imported template may carry.
 *
 * ⚠️ This is a security boundary, not a style guide. `navLabel` is the one free-text field in the
 * whole structural schema, so it is the one place a reference site's own wording could reach a
 * generated template. Matching against a closed list of ordinary Japanese section names means the
 * worst a model can do is pick the wrong ordinary name. */
const CURATED_NAV_LABELS = [
  "ホーム",
  "当院について",
  "診療案内",
  "診療内容",
  "診療科案内",
  "ご挨拶",
  "当院の特徴",
  "施設案内",
  "院内",
  "院内のご案内",
  "お知らせ",
  "診療時間",
  "スタッフ",
  "スタッフ紹介",
  "料金",
  "料金表",
  "よくある質問",
  "アクセス",
  "お問い合わせ",
  "ご予約",
];

/** ⚠️ The block registry's own `defaultNavLabel`s are part of the list, derived rather than copied.
 * `safeNavLabel` falls back to them, so a label missing from the curated list above would be a value
 * this function both produces and rejects — and the invariant "every navLabel in a template is text
 * this codebase owns" would be true in practice but unprovable. Deriving it keeps the two in step
 * when a block type is added. */
export const ALLOWED_NAV_LABELS = new Set(
  [...CURATED_NAV_LABELS, ...BLOCK_TYPES.map((type) => BLOCK_DEFINITIONS[type].defaultNavLabel)].filter(
    (label) => label.length > 0
  )
);

function safeNavLabel(raw: string, fallback: string): string {
  const trimmed = raw.trim().slice(0, NAV_LABEL_MAX);
  return ALLOWED_NAV_LABELS.has(trimmed) ? trimmed : fallback;
}

function safePath(raw: string, index: number, taken: Set<string>): string {
  // ⚠️ Non-ASCII is dropped rather than transliterated. `pageSchema.path` only accepts
  // `[a-z0-9-]`, and a guessed romanisation of a Japanese label is both wrong often enough to
  // embarrass and impossible to verify — `page-3` is honest.
  let path = raw
    .toLowerCase()
    .replace(/\.html?$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (path === "" || RESERVED_PAGE_PATHS.has(path)) path = `page-${index + 1}`;
  let candidate = path;
  for (let n = 2; taken.has(candidate); n++) candidate = `${path}-${n}`;
  taken.add(candidate);
  return candidate;
}

function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as string[]).includes(value);
}

function safeVariant(type: BlockType, raw: string | null): string | undefined {
  if (!raw) return undefined;
  const allowed = variantsFor(type);
  return allowed.includes(raw) ? raw : undefined;
}

function safeCardCount(type: BlockType, raw: number | null): number | undefined {
  // Only the card sections lay themselves out around a count; on anything else it is noise that
  // would be stored, shown in the editor and mean nothing.
  if (type !== "rich" || raw == null || !Number.isFinite(raw)) return undefined;
  return Math.min(CARD_COUNT_RANGE.max, Math.max(CARD_COUNT_RANGE.min, Math.round(raw)));
}

/** Readable, document-wide-unique block ids.
 *
 * ⚠️ Unique across the DOCUMENT, not the page. `slotKey(blockId, i)` is the generated image's
 * FILENAME (site/imagePaths.ts) and every page of a site shares one `images/` directory, so two
 * pages each holding a block called `hours` would overwrite each other's photograph. */
function uniqueId(type: BlockType, taken: Set<string>): string {
  let candidate: string = type;
  for (let n = 2; taken.has(candidate); n++) candidate = `${type}-${n}`;
  taken.add(candidate);
  return candidate;
}

type NormalizedPlan = { pages: PageDef[]; blocks: Block[] };

/** Rebuilds a plan into `{pages, blocks}` a SiteDocument can hold. Falls back wholesale to
 * `one-page-classic` when the model's plan has nothing usable left in it. */
export function normalizeBlockPlan(planned: AiPagePlan[]): NormalizedPlan {
  const takenPaths = new Set<string>();
  const takenIds = new Set<string>();
  const pages: PageDef[] = [];
  const blocks: Block[] = [];
  /** Site-wide, not per page: designCheck wants exactly one お問い合わせ per SITE, which is what
   * makes a dedicated contact page legal in the first place. */
  let contactPlaced = false;

  for (const page of planned.slice(0, MAX_PAGES)) {
    if (blocks.length >= MAX_BLOCKS_TOTAL) break;

    const index = pages.length;
    const usedSingletons = new Set<BlockType>();
    const usedLabels = new Set<string>();
    const pageId = index === 0 ? HOME_PAGE_ID : `page-${index + 1}`;
    const pageBlocks: Block[] = [];

    for (const entry of page.blocks ?? []) {
      if (pageBlocks.length >= MAX_BLOCKS_PER_PAGE) break;
      if (blocks.length + pageBlocks.length >= MAX_BLOCKS_TOTAL) break;

      const type = (entry.type ?? "").trim();
      if (!isBlockType(type)) continue;

      const definition = BLOCK_DEFINITIONS[type];
      if (definition.singleton && usedSingletons.has(type)) continue;
      if (type === "contact") {
        if (contactPlaced) continue;
        contactPlaced = true;
      }
      usedSingletons.add(type);

      // Two links reading 診療案内 in one nav is a dead link as far as the reader is concerned.
      let navLabel = safeNavLabel(entry.navLabel ?? "", definition.defaultNavLabel);
      if (navLabel !== "" && usedLabels.has(navLabel)) navLabel = "";
      if (navLabel !== "") usedLabels.add(navLabel);

      const block = createBlock(type, {
        id: uniqueId(type, takenIds),
        pageId,
        navLabel,
        variant: safeVariant(type, entry.variant),
        cardCount: safeCardCount(type, entry.cardCount),
      });
      // ⚠️ The section's own heading, taken from the nav label.
      //
      // Without this a model-planned structure arrives with unnamed 文章＋カード sections: nothing
      // in the pipeline fills `data.heading` for them — `applySampleCopy` writes the body and the
      // cards but never the heading, and the archetypes only have headings because a person wrote
      // them. Measured on a real import: four sections reported as 「見出しが空です」 by checkDesign.
      //
      // The nav label is the right source and needs no new text: it is what the section is called in
      // the menu, it has already been through the allow-list, and a section whose menu entry and
      // heading disagree is confusing anyway. Only set when the type actually shows a heading and
      // the label is not the empty "keep this out of the nav" marker.
      if (navLabel && "heading" in block.data && !block.data.heading) {
        (block.data as { heading: string }).heading = navLabel;
      }
      pageBlocks.push(block);
    }

    if (pageBlocks.length === 0) continue;

    // A hero anywhere but the top is a banner in the middle of a page. Sub-pages legitimately have
    // none — designCheck only requires one on the home page — so this moves, never inserts.
    const heroAt = pageBlocks.findIndex((b) => b.type === "hero");
    if (heroAt > 0) pageBlocks.unshift(...pageBlocks.splice(heroAt, 1));

    const contactAt = pageBlocks.findIndex((b) => b.type === "contact");
    if (contactAt >= 0 && contactAt < pageBlocks.length - 1) {
      pageBlocks.push(...pageBlocks.splice(contactAt, 1));
    }

    pages.push({
      id: pageId,
      path: index === 0 ? "" : safePath(page.path ?? "", index, takenPaths),
      navLabel: safeNavLabel(page.navLabel ?? "", index === 0 ? "ホーム" : `ページ${index + 1}`),
      // No free text reaches the page's SEO fields: an empty title falls back to meta.seo.
      title: "",
      metaDescription: "",
      inNav: true,
    });
    blocks.push(...pageBlocks);
  }

  if (pages.length === 0) return archetypeBlocks("one-page-classic");

  // The two structural facts designCheck treats as errors, repaired rather than reported: a site
  // with no お問い合わせ and a home page that does not open with a メインビジュアル.
  const home = pages[0];
  if (!blocks.some((b) => b.pageId === home.id && b.type === "hero")) {
    blocks.unshift(createBlock("hero", { id: uniqueId("hero", takenIds), pageId: home.id, navLabel: "" }));
  }
  if (!contactPlaced) {
    const last = pages[pages.length - 1];
    blocks.push(
      createBlock("contact", {
        id: uniqueId("contact", takenIds),
        pageId: last.id,
        navLabel: BLOCK_DEFINITIONS.contact.defaultNavLabel,
      })
    );
  }

  return { pages, blocks };
}

/** The plan the importer will actually build from: the named archetype, or the model's own page list
 * when it says none of them fit.
 *
 * ⚠️ `custom` is the exception, not the rule. When the model names an archetype its own `pages` array
 * is ignored entirely — the archetypes are known-good shapes that have been rendered and checked, and
 * a model asked for both an archetype and a page list will happily return a plan that contradicts the
 * archetype it just chose. */
export function resolveStructure(archetype: string, planned: AiPagePlan[]): NormalizedPlan {
  if (isArchetypeKey(archetype)) return archetypeBlocks(archetype);
  return normalizeBlockPlan(planned ?? []);
}
