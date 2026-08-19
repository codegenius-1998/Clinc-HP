import { randomUUID } from "crypto";
import { d1Query } from "../d1";
import {
  DEFAULT_DESIGN_TOKENS,
  blockSchema,
  designTokensSchema,
  siteDocumentSchema,
  siteMetaSchema,
  type Block,
  type BlockType,
  type SiteDocument,
  type SiteMeta,
} from "./document";

/** D1 persistence for SiteDocument. Templates and sites share these tables — `sites.is_template` is
 * the only discriminator — which is what lets one editor and one renderer serve both.
 *
 * Blocks live in `site_sections`, one row per block instance, ordered by `position`:
 *   site_sections.id       -> "<siteId>:<block.id>"  (see rowId / blockIdFromRow below)
 *   site_sections.sec_id   -> block.type             (one of the fixed catalog rows seeded in 0003)
 *   site_sections.content  -> block.data             (JSON, shape depends on the type)
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
};

type SectionRow = {
  id: string;
  sec_id: string;
  site_id: string;
  content: string | null;
  position: number;
  visible: number;
  nav_label: string | null;
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
  design, meta, mood, tags, source_url, thumbnail_url, updated_at`;

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

/** Rebuilds one block from its row. Returns null for a row that can't be validated — a single bad
 * row must not make the whole site unopenable in the editor, which is the one place it can be fixed. */
function toBlock(row: SectionRow): Block | null {
  const candidate = {
    id: blockIdFromRow(row.site_id, row.id),
    type: row.sec_id as BlockType,
    visible: row.visible === 1,
    navLabel: row.nav_label ?? "",
    data: parseJson<unknown>(row.content, {}),
  };
  const parsed = blockSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn(`[site/store] ブロックを読み込めませんでした (id=${row.id}, type=${row.sec_id})`, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

async function loadDocument(row: SiteRow): Promise<SiteDocument> {
  const sections = await d1Query<SectionRow>(
    "SELECT id, sec_id, site_id, content, position, visible, nav_label FROM site_sections WHERE site_id = ? ORDER BY position",
    [row.id]
  );

  // Rows written before migration 0003 (and by the old admin template screen) have no design/meta at
  // all. Falling back keeps them openable in the editor instead of hard-failing on legacy data.
  const design = designTokensSchema.safeParse(parseJson(row.design, null));
  const meta = siteMetaSchema.safeParse(parseJson(row.meta, null));

  const doc = {
    ...toSummary(row),
    design: design.success ? design.data : DEFAULT_DESIGN_TOKENS,
    meta: meta.success ? meta.data : EMPTY_META,
    blocks: sections.results.map(toBlock).filter((b): b is Block => b !== null),
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

/** Columns per block row in the bulk insert below. SQLite caps bound variables per statement
 * (999 on older builds), so blocks are inserted in chunks that stay comfortably under it. */
const BLOCK_INSERT_COLUMNS = 7;
const BLOCK_CHUNK_SIZE = 100;

export async function saveDocument(doc: SiteDocument): Promise<SiteDocument> {
  const parsed = siteDocumentSchema.parse({ ...doc, updatedAt: new Date().toISOString() });

  await d1Query(
    `INSERT INTO sites (id, name, is_template, can_sell, created_at, slug, owner_email, template_id,
       design, meta, mood, tags, source_url, thumbnail_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       updated_at = excluded.updated_at`,
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
    ]);
    await d1Query(
      `INSERT INTO site_sections (id, sec_id, site_id, content, position, visible, nav_label) VALUES ${placeholders}`,
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
    blocks: template.blocks.map((block) => ({ ...block })),
    createdAt: now,
    updatedAt: now,
  };
}
