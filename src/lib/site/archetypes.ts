import { TEMPLATES, TEMPLATE_KEYS, templateLayout } from "./templateLibrary";
import type { Block, PageDef } from "./document";

/** The block plans a template can be built from — "what sections, on what pages, in what order".
 *
 * ⚠️ This is now a thin view over the template library (`src/lib/site/templates/*.json`), not a
 * registry of its own. It used to hold four page plans written out in TypeScript, which is why
 * adding a fifth shape meant editing code in three places and why every template built from one
 * shared the same sample words. The JSON files are the truth; this module exists so the five callers
 * that already speak in terms of "archetypes" (both importers, blockPlan, templateActions and the
 * admin's select) did not have to change.
 *
 * ⚠️ The key is still NOT stored on a document. These are build-time shapes: the `pages` and
 * `blocks` arrays a template ends up with ARE the truth, and an admin who adds one section in the
 * editor would immediately make a stored key a lie. */

export type ArchetypeKey = string;

export type Archetype = {
  key: ArchetypeKey;
  label: string;
  /** Shown in the admin's import form, and to the model choosing between them. */
  description: string;
};

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = Object.fromEntries(
  TEMPLATE_KEYS.map((key) => [key, { key, label: TEMPLATES[key].name, description: TEMPLATES[key].description }])
);

export const ARCHETYPE_KEYS: ArchetypeKey[] = TEMPLATE_KEYS;

export function isArchetypeKey(value: string): value is ArchetypeKey {
  return value in ARCHETYPES;
}

/** The `pages` and `blocks` a SiteDocument needs, in one flat page-ordered array.
 *
 * ⚠️ The blocks come back carrying the template's OWN sample copy. Callers borrowing a shape for a
 * new template replace it — `applySampleCopy` (generic, free) or `generateSampleCopy` (written for
 * that template, one model call). Both leave headings and layout fields alone, so the structural
 * half of `data` survives either way. Seeding a template from its own file skips both and uses the
 * words in the file. */
export function archetypeBlocks(key: ArchetypeKey): { pages: PageDef[]; blocks: Block[] } {
  return templateLayout(key);
}
