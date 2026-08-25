import { hashToUnit, rotateHue } from "./color";
import type { Block, DesignTokens, SiteDocument } from "./document";

/** Per-clinic layout variety, expressed as a choice among values the renderer already supports.
 *
 * The problem this solves: a template fixed every layout decision for every site built from it. The
 * copy was already written per clinic (generateContentPlan reads the template's real block list), but
 * the skeleton was not — so two clinics on the same template got the same page with different words.
 *
 * The problem it must NOT create: a model inventing layouts. Nothing here accepts CSS, a class name,
 * or a number the renderer has to trust. A "variant" is one value out of a list this file owns, and
 * every value in that list is a layout an existing template already ships — `cardLayout` and
 * `heroLayout` were document-wide settings, and all this does is let them differ per block. That is
 * why no new CSS was needed for any of it, and why an unrecognised variant is simply dropped rather
 * than defended against: the worst case is the template's own layout, which is what happened before.
 *
 * Deliberately NOT included: reordering sections, or hiding them. The order a clinic page tells its
 * story in is a decision the template made on purpose, and shuffling it is where "flexible" turns
 * into "broken". Visibility is already driven by whether the clinic supplied the facts
 * (applyFactualVisibility), which is a better rule than anything a model would infer. */

type CardLayout = DesignTokens["block"]["cardLayout"];
type HeroLayout = DesignTokens["layout"]["heroLayout"];

/** The complete vocabulary. Block types absent from this map take no variant at all. */
export const BLOCK_VARIANTS = {
  hero: ["full-bleed", "split", "centered"] satisfies readonly HeroLayout[],
  rich: ["grid", "list", "minimal", "overlap"] satisfies readonly CardLayout[],
} as const;

export type VariantedBlockType = keyof typeof BLOCK_VARIANTS;

export function variantsFor(type: Block["type"]): readonly string[] {
  return type in BLOCK_VARIANTS ? BLOCK_VARIANTS[type as VariantedBlockType] : [];
}

/** How many cards one 文章＋カード section may hold. Below 2 the grid layouts look like a mistake;
 * above 6 the section stops being scannable and the image bill grows with it. */
export const CARD_COUNT_RANGE = { min: 2, max: 6 } as const;

/** What the model is asked for, before validation. Nulls are expected — "no opinion" is a valid
 * answer and means "keep whatever the template does". */
export type PlannedSection = {
  blockId: string;
  variant: string | null;
  cardCount: number | null;
};

export type Composition = Map<string, { variant?: string; cardCount?: number }>;

/** Turns the model's suggestions into something safe to apply.
 *
 * Written in the same spirit as normalizeDesignTokens (src/lib/template/importFromUrl.ts): the
 * model's output is a proposal, not a fact. Every rule here either accepts a value or falls back to
 * the template's own — it never throws, because a bad suggestion must not be able to fail a
 * generation run that has already spent several minutes and real money. */
export function normalizeComposition(planned: PlannedSection[], doc: SiteDocument): Composition {
  const suggestions = new Map(planned.map((p) => [p.blockId, p]));
  const composition: Composition = new Map();

  /** Variants already used by the preceding visible section of the same type. */
  let previousRichVariant: string | null = null;

  for (const block of doc.blocks) {
    if (!block.visible) continue;
    const allowed = variantsFor(block.type);
    if (allowed.length === 0) continue;

    const suggestion = suggestions.get(block.id);
    const entry: { variant?: string; cardCount?: number } = {};

    let variant: string | undefined =
      suggestion?.variant && allowed.includes(suggestion.variant) ? suggestion.variant : undefined;

    if (block.type === "rich") {
      // Two neighbouring sections in the same layout read as one long section — the very sameness
      // this whole feature exists to break. Nudge to the next allowed variant rather than rejecting,
      // so a model that answers "grid" for everything still produces an alternating page.
      const effective: string = variant ?? doc.design.block.cardLayout;
      if (effective === previousRichVariant) {
        variant = allowed[(allowed.indexOf(effective) + 1) % allowed.length];
      }
      previousRichVariant = variant ?? effective;

      if (suggestion?.cardCount != null && Number.isFinite(suggestion.cardCount)) {
        entry.cardCount = Math.min(
          CARD_COUNT_RANGE.max,
          Math.max(CARD_COUNT_RANGE.min, Math.round(suggestion.cardCount))
        );
      }
    }

    if (variant) entry.variant = variant;
    if (entry.variant !== undefined || entry.cardCount !== undefined) composition.set(block.id, entry);
  }

  return composition;
}

/** Writes the normalized composition into the document. Only `variant` is stored — `cardCount` has
 * already done its job by the time this runs (it shapes what the planner writes), and storing it
 * would create a second source of truth for something `data.cards.length` already says. */
export function applyComposition(doc: SiteDocument, composition: Composition): void {
  for (const block of doc.blocks) {
    const entry = composition.get(block.id);
    if (entry?.variant) block.variant = entry.variant;
  }
}

/** The layout a block actually renders in: its own variant when it has a valid one, the template's
 * document-wide setting otherwise. Every reader of `cardLayout` must go through this — the renderer,
 * the image planner, and the design check — or they will disagree about whether a card has a photo. */
export function effectiveCardLayout(block: Block, design: DesignTokens): CardLayout {
  if (block.type !== "rich") return design.block.cardLayout;
  const allowed: readonly string[] = BLOCK_VARIANTS.rich;
  return block.variant && allowed.includes(block.variant)
    ? (block.variant as CardLayout)
    : design.block.cardLayout;
}

export function effectiveHeroLayout(doc: SiteDocument): HeroLayout {
  const hero = doc.blocks.find((b) => b.type === "hero" && b.visible);
  const allowed: readonly string[] = BLOCK_VARIANTS.hero;
  return hero?.variant && allowed.includes(hero.variant)
    ? (hero.variant as HeroLayout)
    : doc.design.layout.heroLayout;
}

/** How far a clinic's palette may drift from its template's, in degrees of hue.
 *
 * Small on purpose. The admin chose that template because its atmosphere suits the clinic, and a
 * large rotation would hand them a different atmosphere — a warm template turning cool is not
 * "variety", it is a different product. ±24° is roughly the width of one colour name: a blue stays
 * blue while two blues become visibly distinct side by side. */
const MAX_HUE_SHIFT = 24;

/** Gives each clinic its own shade of the template's palette, derived from its slug so a rebuild
 * reproduces it exactly.
 *
 * Only the three brand colours turn. `text`, `background` and the two inverse colours are left
 * alone: they are near-neutral by design, rotating them would tint the whole page, and readability
 * (which `readableOn` / `readableFill` derive from these at render time) has to stay predictable. */
export function derivePalette(colors: DesignTokens["colors"], seed: string): DesignTokens["colors"] {
  const shift = (hashToUnit(seed) * 2 - 1) * MAX_HUE_SHIFT;
  return {
    ...colors,
    primary: rotateHue(colors.primary, shift),
    accent: rotateHue(colors.accent, shift),
    light: rotateHue(colors.light, shift),
  };
}
