import sparkle from "./sparkle";
import botanical from "./botanical";

/** Style kits: the CSS (and optionally the JS) that belongs to ONE template rather than to every
 * site.
 *
 * ⚠️ Why a NAME on the document instead of the CSS itself. `SiteDocument` is one shape for a template
 * and for a real clinic's site, and `instantiateTemplate` clones one into the other — so a field
 * holding raw CSS or raw JS would be a field that the URL importer (whose content is a model's
 * reading of an arbitrary third-party website) could fill, and whose contents end up inside a
 * published medical practice's page. A document therefore stores only `design.layout.styleKit`, a
 * key; the code lives here, in the repository, under review. Untrusted input can name a kit, and
 * naming one that does not exist resolves to nothing at all.
 *
 * This is the same containment `composition.ts` uses for `variant`, for the same reason and with the
 * same failure mode: the worst case is the template's plain appearance, which is what every site
 * looked like before kits existed.
 *
 * ⚠️ Static imports, not a runtime directory read — `next.config.ts` sets `output: "standalone"`,
 * which does not trace a file nothing imports. A `readdir` here would work in dev and find an empty
 * directory in production. Same reasoning, and the same one-line-per-entry cost, as
 * `src/lib/site/templates/index.ts`; `scripts/verify-templates.mts` fails when a template names a
 * kit this registry does not have. */

export type StyleKit = {
  /** Written to `<outDir>/css/kit.css` and linked AFTER site.css, so it wins at equal specificity. */
  css: string;
  /** Written to `<outDir>/js/kit.js` and loaded with `defer` after main.js. Optional — most kits are
   * CSS only, and CSS cannot be made to do anything a viewer did not ask for. */
  js?: string;
};

export const STYLE_KITS: Record<string, StyleKit> = {
  sparkle,
  botanical,
};

export const STYLE_KIT_KEYS = Object.keys(STYLE_KITS);

/** The kit a document asks for, or null. Never throws: an unknown key is not an error condition but
 * an older or hand-edited document, and the right answer for one is the plain page. */
export function resolveStyleKit(key: string | undefined): StyleKit | null {
  if (!key) return null;
  return STYLE_KITS[key] ?? null;
}
