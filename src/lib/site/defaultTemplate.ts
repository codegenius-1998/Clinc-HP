import { newDocumentId } from "./store";
import { TEMPLATES, templateLayout, toDocument } from "./templateLibrary";
import type { Block, SiteDocument } from "./document";

/** The stock clinic layout, used as the fallback template when D1 holds none that fit (a brand-new
 * install, or every template still marked can_sell = 0).
 *
 * ⚠️ Nothing is defined here any more. The shape, the palette and the sample copy all live in
 * `templates/one-page-classic.json`; this module is the two named entry points that the rest of the
 * code already calls. Keeping them means `selectTemplate`'s fallback and the verification scripts
 * did not have to change when templates moved out of TypeScript. */

const KEY = "one-page-classic";

export function defaultTemplateBlocks(): Block[] {
  return templateLayout(KEY).blocks;
}

export function buildDefaultTemplate(): SiteDocument {
  return toDocument(TEMPLATES[KEY], newDocumentId());
}
