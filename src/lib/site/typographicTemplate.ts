import { newDocumentId } from "./store";
import { TEMPLATES, templateLayout, toDocument } from "./templateLibrary";
import type { Block, SiteDocument } from "./document";

/** A template that carries its impact in type and space rather than in photographs — 明朝 headings,
 * wide tracking, hairline rules, no shadows and no rounded corners.
 *
 * ⚠️ Defined in `templates/one-page-editorial.json` now, not here. This module is the named entry
 * points; `scripts/seed-template.mts` and `scripts/verify-archetypes.mts` call them.
 *
 * ⚠️ The slug in that file must stay `typographic-template`. The seeded row in D1 carries seven real
 * photographs whose filenames come from this template's block ids, and the preview on disk is keyed
 * on the slug. */

const KEY = "one-page-editorial";

export function typographicTemplateBlocks(): Block[] {
  return templateLayout(KEY).blocks;
}

export function buildTypographicTemplate(): SiteDocument {
  return toDocument(TEMPLATES[KEY], newDocumentId());
}
