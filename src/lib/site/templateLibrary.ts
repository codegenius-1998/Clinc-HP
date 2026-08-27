import { z } from "zod";
import { siteDocumentSchema, type Block, type PageDef, type SiteDocument } from "./document";
import { TEMPLATE_SOURCES } from "./templates";

/** The template library: one JSON file per template, under `src/lib/site/templates/`.
 *
 * ⚠️ This replaces a design where every template's structure, palette and sample copy lived in
 * TypeScript. Adding one meant editing three files (a new `xxxTemplate.ts`, an entry in
 * `archetypes.ts`, and a branch in `seed-template.mts`) — and because the sample copy was shared by
 * all of them, two templates could only ever differ by colour, typeface and section order. Every
 * word a reader's eye actually lands on was byte-identical. Now a template is one file that carries
 * its own fictional clinic, its own words and its own decoration, and adding one touches no code.
 *
 * ⚠️ No new validation. The file's shape is `siteDocumentSchema` minus the fields that belong to the
 * database rather than to the design (`id`, timestamps, ownership). A template file that parses is a
 * document that saves. */

export const templateFileSchema = siteDocumentSchema
  .pick({ slug: true, name: true, mood: true, tags: true, design: true, meta: true, pages: true, blocks: true })
  .extend({
    /** One line for the admin's 「ページ構成」 select. `mood` is written for the auto-selector to read;
     * this is written for a person choosing from a dropdown. */
    description: z.string().default(""),
  });

export type TemplateFile = z.infer<typeof templateFileSchema>;

/** ⚠️ Parsed eagerly, and it THROWS. These files are committed to the repository and checked by
 * `scripts/verify-templates.mts` and by `npm run build`, so a malformed one cannot reach production
 * without having been malformed in CI first. Failing loudly at boot with the filename in the message
 * beats a template silently disappearing from the library. */
function parseAll(): Record<string, TemplateFile> {
  const parsed: Record<string, TemplateFile> = {};
  for (const [key, source] of Object.entries(TEMPLATE_SOURCES)) {
    const result = templateFileSchema.safeParse(source);
    if (!result.success) {
      throw new Error(
        `テンプレート定義 src/lib/site/templates/${key}.json を読み込めません:\n` +
          result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")
      );
    }
    parsed[key] = result.data;
  }
  return parsed;
}

export const TEMPLATES: Record<string, TemplateFile> = parseAll();
export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export function isTemplateKey(value: string): boolean {
  return value in TEMPLATES;
}

/** The pages and blocks of one template.
 *
 * ⚠️ Deep-copied, always. The parsed files are module-level objects shared by every caller, so
 * handing out references would let one import's edit reach every later one — the same defect
 * `DEFAULT_DESIGN_TOKENS` had (SPEC 13.19), and it would be far harder to spot here because the
 * symptom is "two templates came out identical", which is what this whole change is about.
 *
 * ⚠️ `data` comes back AS AUTHORED, including the template's own sample words. Callers that want a
 * bare skeleton (the URL importer borrowing a shape) run `applySampleCopy` or `generateSampleCopy`
 * over the result, both of which replace the copy while leaving headings, gallery column counts and
 * text alignment — the structural half of `data` — alone. */
export function templateLayout(key: string): { pages: PageDef[]; blocks: Block[] } {
  const file = TEMPLATES[key];
  if (!file) throw new Error(`テンプレート定義「${key}」がありません。`);
  return { pages: structuredClone(file.pages), blocks: structuredClone(file.blocks) as Block[] };
}

/** A template file plus the identity the database needs. */
export function toDocument(file: TemplateFile, id: string, options: { canSell?: boolean } = {}): SiteDocument {
  const now = new Date().toISOString();
  return {
    id,
    slug: file.slug,
    name: file.name,
    isTemplate: true,
    canSell: options.canSell ?? true,
    design: structuredClone(file.design),
    meta: structuredClone(file.meta),
    pages: structuredClone(file.pages),
    blocks: structuredClone(file.blocks) as Block[],
    mood: file.mood,
    tags: [...file.tags],
    createdAt: now,
    updatedAt: now,
  };
}

/** The subset of a stored document that belongs in a template file — everything except the identity
 * and the ownership. Used by scripts/export-template.mts to turn a template an admin liked into a
 * file that can be committed. */
export function toTemplateFile(doc: SiteDocument, description = ""): TemplateFile {
  return templateFileSchema.parse({
    slug: doc.slug,
    name: doc.name,
    description,
    mood: doc.mood,
    tags: doc.tags,
    design: doc.design,
    meta: doc.meta,
    pages: doc.pages,
    blocks: doc.blocks,
  });
}
