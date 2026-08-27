import { randomUUID } from "crypto";
import { d1Query } from "../d1";
import {
  DEFAULT_DESIGN_TOKENS,
  blockSchema,
  designTokensSchema,
  siteDocumentSchema,
  siteMetaSchema,
  storedChromeSchema,
  defaultPages,
  pageSchema,
  type Block,
  type BlockType,
  type SiteDocument,
  type SiteMeta,
} from "./document";
import { normalizePages } from "./pages";
import { z } from "zod";

/** D1 persistence for SiteDocument. Templates and sites share these tables — `sites.is_template` is
 * the only discriminator — which is what lets one editor and one renderer serve both.
 *
 * Blocks live in `site_sections`, one row per block instance, ordered by `position`:
 *   site_sections.id       -> "<siteId>:<block.id>"  (see rowId / blockIdFromRow below)
 *   site_sections.sec_id   -> block.type             (one of the fixed catalog rows seeded in 0003)
 *   site_sections.content  -> block.data             (JSON, shape depends on the type)
 *   site_sections.attrs    -> everything else on the block (JSON — see BLOCK_COLUMN_FIELDS)
 *
 * A block id only has to be unique WITHIN its document, and templates deliberately use readable ones
 * ("hero", "department") because they become the page's HTML anchors. `site_sections.id` is a global
 * primary key, so the stored row id is namespaced by site id — otherwise the second template to
 * contain a block called "hero" fails to insert.
 *
 * `src/lib/d1.ts`'s d1Query sends exactly one statement per HTTP round trip, so saving is written as
 * a small fixed number of statements (upsert + delete + chunked multi-row insert) rather than one
 * statement per block — the difference is ~4 round trips instead of ~20. */

const EMPTY_META: SiteMeta = {
  clinicName: "",
  phone: "",
  line: "",
  address: "",
  logoImage: "images/logo.png",
  seo: { title: "", metaDescription: "", ogTitle: "", ogDescription: "", ogSiteName: "" },
  snsLinks: [],
};

type SiteRow = {
  id: string;
  name: string;
  is_template: number;
  can_sell: number;
  created_at: string;
  slug: string | null;
  owner_email: string | null;
  template_id: string | null;
  design: string | null;
  meta: string | null;
  mood: string | null;
  tags: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  updated_at: string | null;
  chrome: string | null;
  pages: string | null;
};

type SectionRow = {
  id: string;
  sec_id: string;
  site_id: string;
  content: string | null;
  position: number;
  visible: number;
  nav_label: string | null;
  attrs: string | null;
  page_id: string | null;
};

/** Header-only view for list screens and for the template auto-selector, which must not pay for
 * every template's full block tree just to read its `mood`. */
export type DocumentSummary = {
  id: string;
  slug: string;
  name: string;
  isTemplate: boolean;
  canSell: boolean;
  ownerEmail?: string;
  templateId?: string;
  mood?: string;
  tags: string[];
  sourceUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
};

const SITE_COLUMNS = `id, name, is_template, can_sell, created_at, slug, owner_email, template_id,
  design, meta, mood, tags, source_url, thumbnail_url, updated_at, chrome, pages`;

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** "<siteId>:<blockId>" — the stored primary key for one block row. */
function rowId(siteId: string, blockId: string): string {
  return `${siteId}:${blockId}`;
}

/** Inverse of `rowId`. An unprefixed value is passed through unchanged, so rows written before the
 * namespacing still load rather than reading back as corrupt. */
function blockIdFromRow(siteId: string, storedId: string): string {
  const prefix = `${siteId}:`;
  return storedId.startsWith(prefix) ? storedId.slice(prefix.length) : storedId;
}

function toSummary(row: SiteRow): DocumentSummary {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    name: row.name,
    isTemplate: row.is_template === 1,
    canSell: row.can_sell === 1,
    ownerEmail: row.owner_email ?? undefined,
    templateId: row.template_id ?? undefined,
    mood: row.mood ?? undefined,
    tags: parseJson<string[]>(row.tags, []),
    sourceUrl: row.source_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Block fields that have a column of their own. Everything else a Block carries is presentational
 * and is written to `attrs` by exclusion — which is the point of the shape: adding a field to
 * `blockCommon` persists with no migration and no edit here. Keeping this set in step is the one
 * obligation that creates.
 *
 * ⚠️ `data` is listed because it has its own column (`content`), not because it is skipped. */
const BLOCK_COLUMN_FIELDS = new Set(["id", "type", "visible", "navLabel", "pageId", "data"]);

/** The `attrs` blob for one block: variant, spacing, textStyles, containerStyles, and whatever is
 * added later. `null` rather than "{}" when there is nothing to store, so the column stays a useful
 * signal of "this block has no overrides". */
function blockAttrsJson(block: Block): string | null {
  const attrs = Object.fromEntries(
    Object.entries(block).filter(([key, value]) => !BLOCK_COLUMN_FIELDS.has(key) && value !== undefined)
  );
  return Object.keys(attrs).length > 0 ? JSON.stringify(attrs) : null;
}

/** Rebuilds one block from its row. Returns null for a row that can't be validated — a single bad
 * row must not make the whole site unopenable in the editor, which is the one place it can be fixed.
 *
 * ⚠️ Two-stage on purpose. `attrs` is the one part of a row that can be stale in a way `content`
 * cannot: a `textStyles` key that no longer matches `fieldPathPattern`, a `variant` written as a
 * number by some future bug. A single parse would fail on that and return null — and a null here
 * deletes the section from a published page. So a bad blob costs the block its styling, which is
 * exactly the state it was in before this column existed, never the block itself. */
function toBlock(row: SectionRow): Block | null {
  const base = {
    id: blockIdFromRow(row.site_id, row.id),
    type: row.sec_id as BlockType,
    visible: row.visible === 1,
    navLabel: row.nav_label ?? "",
    // NULL means "written before multi-page rendering", and `pageId`'s schema default puts those on
    // the home page — which is where they already were.
    ...(row.page_id ? { pageId: row.page_id } : {}),
    data: parseJson<unknown>(row.content, {}),
  };
  // Spread attrs FIRST so a corrupt blob can never override id / type / visible / data.
  const attrs = parseJson<Record<string, unknown>>(row.attrs, {});
  const full = blockSchema.safeParse({ ...attrs, ...base });
  if (full.success) return full.data;

  const bare = blockSchema.safeParse(base);
  if (!bare.success) {
    console.warn(`[site/store] ブロックを読み込めませんでした (id=${row.id}, type=${row.sec_id})`, bare.error.issues);
    return null;
  }
  console.warn(`[site/store] ブロックの表示設定を読み込めませんでした (id=${row.id})`, full.error.issues);
  return bare.data;
}

async function loadDocument(row: SiteRow): Promise<SiteDocument> {
  const sections = await d1Query<SectionRow>(
    "SELECT id, sec_id, site_id, content, position, visible, nav_label, attrs, page_id FROM site_sections WHERE site_id = ? ORDER BY position",
    [row.id]
  );

  // Rows written before migration 0003 (and by the old admin template screen) have no design/meta at
  // all. Falling back keeps them openable in the editor instead of hard-failing on legacy data.
  const design = designTokensSchema.safeParse(parseJson(row.design, null));
  const meta = siteMetaSchema.safeParse(parseJson(row.meta, null));
  // Same treatment for the chrome overrides (migration 0005): every row written before it has NULL
  // here, which must read as "no overrides" rather than as a broken document.
  const chrome = storedChromeSchema.safeParse(parseJson(row.chrome, null));

  // ⚠️ Parsed defensively BEFORE the whole-document parse below, which throws rather than falling
  // back the way `design` and `meta` do. Without this, one malformed `pages` blob would make a site
  // impossible to open in the editor AND impossible to re-render — i.e. unfixable through the UI.
  const storedPages = z.array(pageSchema).safeParse(parseJson(row.pages, null));

  const loaded = normalizePages(
    storedPages.success && storedPages.data.length > 0 ? storedPages.data : defaultPages(),
    sections.results.map(toBlock).filter((b): b is Block => b !== null)
  );

  const doc = {
    ...toSummary(row),
    // ⚠️ structuredClone on the fallback path. Without it every document whose stored design failed
    // to parse shares ONE object, so a single write (applyImagePaths sets design.layout.backdropImage)
    // reaches all of them and the module constant besides.
    design: design.success ? design.data : structuredClone(DEFAULT_DESIGN_TOKENS),
    meta: meta.success ? meta.data : EMPTY_META,
    ...(chrome.success ? chrome.data : {}),
    pages: loaded.pages,
    blocks: loaded.blocks,
  };

  const parsed = siteDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    throw new Error(`サイトデータの形式が正しくありません（id=${row.id}）: ${parsed.error.issues[0]?.message ?? ""}`);
  }
  return parsed.data;
}

export async function getDocument(id: string): Promise<SiteDocument | null> {
  const result = await d1Query<SiteRow>(`SELECT ${SITE_COLUMNS} FROM sites WHERE id = ?`, [id]);
  const row = result.results[0];
  return row ? loadDocument(row) : null;
}

export async function getDocumentBySlug(slug: string): Promise<SiteDocument | null> {
  const result = await d1Query<SiteRow>(`SELECT ${SITE_COLUMNS} FROM sites WHERE slug = ?`, [slug]);
  const row = result.results[0];
  return row ? loadDocument(row) : null;
}

/** Templates, newest first. `sellableOnly` is what the auto-selector passes: a template still being
 * worked on (can_sell = 0) must never be handed to a real clinic. */
export async function listTemplates(options?: { sellableOnly?: boolean }): Promise<DocumentSummary[]> {
  const sql = options?.sellableOnly
    ? `SELECT ${SITE_COLUMNS} FROM sites WHERE is_template = 1 AND can_sell = 1 ORDER BY created_at DESC`
    : `SELECT ${SITE_COLUMNS} FROM sites WHERE is_template = 1 ORDER BY created_at DESC`;
  return (await d1Query<SiteRow>(sql)).results.map(toSummary);
}

/** Which section patterns existing templates already use, so a freshly imported one can pick a
 * different one (see site/decoration.ts).
 *
 * ⚠️ One statement, reading only the `design` column, rather than `listTemplates()` plus a
 * `getDocument()` per row — d1.ts sends exactly one statement per round trip, so the obvious version
 * would cost one HTTP request per existing template on every import. A malformed row is skipped
 * rather than thrown on: decoration is a nicety, and failing an import over it would be absurd. */
export async function usedOrnaments(): Promise<Set<string>> {
  const rows = await d1Query<{ design: string | null }>("SELECT design FROM sites WHERE is_template = 1");
  const used = new Set<string>();
  for (const row of rows.results) {
    const ornament = parseJson<{ layout?: { ornament?: string } }>(row.design, {}).layout?.ornament;
    if (ornament && ornament !== "none") used.add(ornament);
  }
  return used;
}

/** Generated (non-template) sites. Pass `ownerEmail` for /mypage, which must never leak another
 * clinic's sites; omit it for the admin screens. */
export async function listSiteDocuments(options?: { ownerEmail?: string }): Promise<DocumentSummary[]> {
  if (options?.ownerEmail) {
    return (
      await d1Query<SiteRow>(
        `SELECT ${SITE_COLUMNS} FROM sites WHERE is_template = 0 AND owner_email = ? ORDER BY created_at DESC`,
        [options.ownerEmail]
      )
    ).results.map(toSummary);
  }
  return (await d1Query<SiteRow>(`SELECT ${SITE_COLUMNS} FROM sites WHERE is_template = 0 ORDER BY created_at DESC`))
    .results.map(toSummary);
}

/** ⚠️ D1 caps bound parameters per query at 100 — not at SQLite's own 999, which is what an earlier
 * comment here assumed. Measured: a 13-block document at 8 columns (104 parameters) fails outright
 * with `too many SQL variables`, while the same document at 7 columns (91) succeeds.
 *
 * That means the previous `BLOCK_CHUNK_SIZE = 100` was never real. It happened to work only because
 * no template had yet reached 15 blocks (15 x 7 = 105); a site with one more section would have
 * failed to save with an error naming neither the site nor the block.
 *
 * So the chunk size is DERIVED rather than written down, and adding a column to the insert can no
 * longer silently push the statement over the limit. */
const D1_MAX_BOUND_PARAMS = 100;
const BLOCK_INSERT_COLUMNS = 9;
const BLOCK_CHUNK_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / BLOCK_INSERT_COLUMNS);

/** The `sites.chrome` blob: the two document-level styling records, or null when neither is set. */
function chromeJson(doc: SiteDocument): string | null {
  if (!doc.metaTextStyles && !doc.chromeSpacing) return null;
  return JSON.stringify({ metaTextStyles: doc.metaTextStyles, chromeSpacing: doc.chromeSpacing });
}

export async function saveDocument(doc: SiteDocument): Promise<SiteDocument> {
  // ⚠️ Reconciled on the way IN as well as on the way out (loadDocument). A block pointing at a page
  // that no longer exists renders on no page at all, and this is the last moment that is cheap to
  // fix — after the write it is a live site quietly missing a section.
  const reconciled = normalizePages(doc.pages, doc.blocks);
  const parsed = siteDocumentSchema.parse({
    ...doc,
    pages: reconciled.pages,
    blocks: reconciled.blocks,
    updatedAt: new Date().toISOString(),
  });

  await d1Query(
    `INSERT INTO sites (id, name, is_template, can_sell, created_at, slug, owner_email, template_id,
       design, meta, mood, tags, source_url, thumbnail_url, updated_at, chrome, pages)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       is_template = excluded.is_template,
       can_sell = excluded.can_sell,
       slug = excluded.slug,
       owner_email = excluded.owner_email,
       template_id = excluded.template_id,
       design = excluded.design,
       meta = excluded.meta,
       mood = excluded.mood,
       tags = excluded.tags,
       source_url = excluded.source_url,
       thumbnail_url = excluded.thumbnail_url,
       updated_at = excluded.updated_at,
       chrome = excluded.chrome,
       pages = excluded.pages`,
    [
      parsed.id,
      parsed.name,
      parsed.isTemplate ? 1 : 0,
      parsed.canSell ? 1 : 0,
      parsed.createdAt,
      parsed.slug,
      parsed.ownerEmail ?? null,
      parsed.templateId ?? null,
      JSON.stringify(parsed.design),
      JSON.stringify(parsed.meta),
      parsed.mood ?? null,
      JSON.stringify(parsed.tags),
      parsed.sourceUrl ?? null,
      parsed.thumbnailUrl ?? null,
      parsed.updatedAt,
      chromeJson(parsed),
      JSON.stringify(parsed.pages),
    ]
  );

  // Replace-all rather than diff: block ids are stable but order, membership and content all change
  // freely in the editor, and a diff would have to handle every combination for no practical gain.
  await d1Query("DELETE FROM site_sections WHERE site_id = ?", [parsed.id]);

  for (let start = 0; start < parsed.blocks.length; start += BLOCK_CHUNK_SIZE) {
    const chunk = parsed.blocks.slice(start, start + BLOCK_CHUNK_SIZE);
    const placeholders = chunk.map(() => `(${Array(BLOCK_INSERT_COLUMNS).fill("?").join(", ")})`).join(", ");
    const params = chunk.flatMap((block, i) => [
      rowId(parsed.id, block.id),
      block.type,
      parsed.id,
      JSON.stringify(block.data),
      start + i,
      block.visible ? 1 : 0,
      block.navLabel,
      blockAttrsJson(block),
      block.pageId,
    ]);
    await d1Query(
      `INSERT INTO site_sections (id, sec_id, site_id, content, position, visible, nav_label, attrs, page_id) VALUES ${placeholders}`,
      params
    );
  }

  return parsed;
}

export async function deleteDocument(id: string): Promise<void> {
  // site_sections has ON DELETE CASCADE against sites(id), but D1 only enforces foreign keys when
  // they're switched on for the connection — deleting the child rows explicitly is not optional here.
  await d1Query("DELETE FROM site_sections WHERE site_id = ?", [id]);
  await d1Query("DELETE FROM sites WHERE id = ?", [id]);
}

export function newDocumentId(): string {
  return randomUUID();
}

/** Deep-copies a template into a brand-new site document: fresh ids everywhere (so the two never
 * share a row), template link recorded, template-only fields dropped. Content is left as the
 * template's sample text — the generator overwrites it right after. */
export function instantiateTemplate(
  template: SiteDocument,
  init: { slug: string; name: string; ownerEmail?: string }
): SiteDocument {
  const now = new Date().toISOString();
  return {
    ...template,
    id: newDocumentId(),
    slug: init.slug,
    name: init.name,
    isTemplate: false,
    canSell: false,
    templateId: template.id,
    ownerEmail: init.ownerEmail,
    mood: undefined,
    sourceUrl: undefined,
    thumbnailUrl: undefined,
    // Block ids carry over verbatim. They double as the page's HTML anchors, so "#department" reads
    // better than a random id, and `rowId` already namespaces the stored row by document — two sites
    // cloned from the same template cannot collide on insert.
    //
    // ⚠️ Deep, not shallow. `{...block}` left `data`, `spacing`, `textStyles` and `containerStyles`
    // shared by reference with the template still in memory. That was harmless only for as long as
    // those fields were discarded on save; now that they persist, editing the new site's spacing
    // would reach into the template object the generator is still holding.
    blocks: template.blocks.map((block) => structuredClone(block)),
    createdAt: now,
    updatedAt: now,
  };
}
