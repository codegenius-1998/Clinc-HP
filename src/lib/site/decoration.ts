import { hashToUnit } from "./color";
import type { DesignTokens } from "./document";

/** Assigns a template its decoration: a pattern, a slow motion for it, and the shape of the header
 * and footer.
 *
 * ⚠️ This exists because faithfulness produced sameness. The importer reads a reference site and
 * copies what it finds — and what it finds, on essentially every Japanese clinic site, is a
 * horizontal nav bar, a dark footer, no pattern and no ambient motion. Those are exactly the default
 * values, so a correct, faithful import came out looking identical to every other one. The request
 * was "the templates have no motion, no sparkle and no background material — how do we fix that",
 * and the answer cannot be "copy the reference site's absence of them".
 *
 * So these four axes move to the other side of the line: structure, palette and typography stay
 * faithful to the reference, and decoration is something this app supplies.
 *
 * ⚠️ Derived from a seed, never random. `derivePalette` (composition.ts) uses the same `hashToUnit`
 * for the same reason: rebuilding a template must reproduce it, or a regeneration would silently
 * redecorate a page a clinic has already approved. */

export type Decoration = {
  ornament: DesignTokens["layout"]["ornament"];
  ornamentStrength: number;
  ambient: DesignTokens["animation"]["ambient"];
  progressBar: boolean;
  header: DesignTokens["chrome"]["header"];
  footer: DesignTokens["chrome"]["footer"];
};

/** ⚠️ "none" is not in this list. It is a valid token value and the design panel offers it, but a
 * template that is auto-decorated and then given no pattern is the one outcome this module exists to
 * prevent. Choosing nothing is a decision for a person to make in the editor. */
const ORNAMENTS = ["seigaiha", "asanoha", "dots-fine", "hairlines", "arc"] as const;

/** ⚠️ Likewise no "none": ambient motion IS the 動くキラキラ that was asked for. Scroll reveal is a
 * separate axis (`animation.reveal`) and is not affected by this. */
const AMBIENTS = ["drift", "float", "sheen"] as const;

const HEADERS = ["bar", "stacked", "minimal"] as const;
const FOOTERS = ["dark", "light", "compact", "band"] as const;

/** A pattern strong enough to see and weak enough to stay behind the words.
 * Measured: at 0.3 the pattern is the loudest thing on the page and the cards float on wallpaper. */
const STRENGTH = { min: 0.1, max: 0.22 } as const;

/** One deterministic choice out of a list. `salt` keeps the axes independent — without it every axis
 * would read the same number and a template with the first ornament would always get the first
 * ambient and the first footer too. */
function pick<T>(list: readonly T[], seed: string, salt: string): T {
  return list[Math.min(list.length - 1, Math.floor(hashToUnit(`${seed}:${salt}`) * list.length))];
}

export function decorationFor(
  seed: string,
  takenOrnaments: ReadonlySet<string> = new Set(),
  options: { hasPhone?: boolean } = {}
): Decoration {
  // Prefer a pattern no existing template is using, so the first five templates are guaranteed to
  // differ at a glance rather than merely probably. Past five the hash decides and two may repeat —
  // but the ambient/header/footer combination still gives 5 x 3 x 3 x 4 = 180 distinguishable sets.
  const unused = ORNAMENTS.filter((value) => !takenOrnaments.has(value));
  const ornament = pick(unused.length > 0 ? unused : ORNAMENTS, seed, "ornament");

  // ⚠️ `header: "minimal"` hides `.header-tel` (site.css). On a clinic site the phone number is the
  // conversion, so a template that carries one never gets the form that hides it.
  const headers = options.hasPhone ? HEADERS.filter((value) => value !== "minimal") : HEADERS;

  return {
    ornament,
    ornamentStrength: Number(
      (STRENGTH.min + hashToUnit(`${seed}:strength`) * (STRENGTH.max - STRENGTH.min)).toFixed(2)
    ),
    ambient: pick(AMBIENTS, seed, "ambient"),
    progressBar: hashToUnit(`${seed}:progress`) < 0.5,
    header: pick(headers, seed, "header"),
    footer: pick(FOOTERS, seed, "footer"),
  };
}

/** Writes every axis. For the paths where nothing else had an opinion. */
export function applyDecoration(design: DesignTokens, decoration: Decoration): void {
  design.layout.ornament = decoration.ornament;
  design.layout.ornamentStrength = decoration.ornamentStrength;
  design.animation.ambient = decoration.ambient;
  design.animation.progressBar = decoration.progressBar;
  design.chrome.header = decoration.header;
  design.chrome.footer = decoration.footer;
}

/** Writes only the axes still sitting at their default value.
 *
 * ⚠️ Per axis, not all-or-nothing. When the model reports that the reference site really does have a
 * pattern, or a stacked header, or a pale footer, that observation is worth more than our assignment
 * and is kept — while the axes it answered "none"/"bar"/"dark" on (i.e. told us nothing) get filled.
 * Treating the whole set as one decision would throw away a correct observation because of an
 * uninformative one next to it. */
export function fillMissingDecoration(design: DesignTokens, decoration: Decoration): void {
  if (design.layout.ornament === "none") {
    design.layout.ornament = decoration.ornament;
    design.layout.ornamentStrength = decoration.ornamentStrength;
    design.animation.ambient = decoration.ambient;
    design.animation.progressBar = decoration.progressBar;
  }
  if (design.chrome.header === "bar") design.chrome.header = decoration.header;
  if (design.chrome.footer === "dark") design.chrome.footer = decoration.footer;
}
