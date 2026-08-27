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

/** The complete vocabulary. Block types absent from this map take no variant at all.
 *
 * ⚠️ The FIRST value of every list is what that block type has always rendered as. A block with no
 * variant, or with the first value, is byte-identical to what it was before this list grew — which
 * is what makes adding a variant safe rather than a redesign of every existing site.
 *
 * `hero` and `rich` are special only in how they reach the DOM: they were document-wide design
 * tokens before they were per-block variants, so they keep their `hero-*` / `cards-*` class names
 * and their fallback to `design.layout.heroLayout` / `design.block.cardLayout`. Everything else
 * renders as a `<type>-<variant>` class on the section itself (see `sectionVariantClass`). */
export const BLOCK_VARIANTS = {
  hero: ["full-bleed", "split", "centered"] satisfies readonly HeroLayout[],
  rich: ["grid", "list", "minimal", "overlap"] satisfies readonly CardLayout[],
  hours: ["table", "stripe", "card"],
  pricing: ["table", "cards"],
  faq: ["accordion", "open", "two-col"],
  staff: ["grid", "list", "portrait"],
  news: ["list", "cards"],
  gallery: ["grid", "masonry", "marquee"],
  access: ["map-below", "map-side"],
  contact: ["buttons", "panel", "band"],
  freeText: ["plain", "quote", "rule"],
} as const;

/** One line per variant, for the content planner's prompt.
 *
 * ⚠️ Built from this map rather than hand-listed in the prompt. The prompt used to spell out seven
 * layouts in prose; with a vocabulary this size that list would drift, and a variant the model was
 * never told about is one it never chooses — the feature would look broken rather than unused. */
export const VARIANT_DESCRIPTIONS: Record<string, string> = {
  "hero:full-bleed": "大きな写真いっぱいに文字を重ねる",
  "hero:split": "写真と文字を左右に分ける",
  "hero:centered": "写真の下に文字を置く",
  "rich:grid": "写真つきカードを格子状に並べる",
  "rich:list": "写真と文章を横並びにした記事的な見た目",
  "rich:minimal": "写真を使わず、連番と文字だけで見せる",
  "rich:overlap": "カードを少しずらして重ねる雑誌的な見た目",
  "hours:table": "ふつうの表",
  "hours:stripe": "1行おきに色を敷いた表",
  "hours:card": "曜日ごとのカードを並べる（行数が少ないときに向く）",
  "pricing:table": "ふつうの料金表",
  "pricing:cards": "料金をカードで並べる（項目が少ないときに向く）",
  "faq:accordion": "クリックで開く（件数が多いときに向く）",
  "faq:open": "最初から全部開いた状態（件数が少ないときに向く）",
  "faq:two-col": "2列に並べる",
  "staff:grid": "正方形の写真を格子状に",
  "staff:list": "写真を左、紹介文を右に横並び",
  "staff:portrait": "縦長の写真で人物を大きく",
  "news:list": "日付と見出しの一覧",
  "news:cards": "カードで並べる（件数が少ないときに向く）",
  "gallery:grid": "同じ大きさで格子状に",
  "gallery:masonry": "高さの違う写真を積む",
  "gallery:marquee": "写真が横へゆっくり流れ続ける帯（写真が4枚以上あるときに向く）",
  "access:map-below": "住所の下に地図",
  "access:map-side": "住所と地図を左右に",
  "contact:buttons": "見出しと文章の下にボタン",
  "contact:panel": "枠で囲んだ案内",
  "contact:band": "色地の帯で強調する",
  "freeText:plain": "そのまま本文として置く",
  "freeText:quote": "引用のように縦罫を添える",
  "freeText:rule": "上下を細い罫線で挟む",
};

export type VariantedBlockType = keyof typeof BLOCK_VARIANTS;

export function variantsFor(type: Block["type"]): readonly string[] {
  return type in BLOCK_VARIANTS ? BLOCK_VARIANTS[type as VariantedBlockType] : [];
}

/** The class a section carries for its variant, or "" for none.
 *
 * `hero` and `rich` are excluded because their variants already reach the DOM through
 * `effectiveHeroLayout` / `effectiveCardLayout`, which additionally fall back to the document-wide
 * token. Adding a second class for them would let the two disagree.
 *
 * ⚠️ The `v-` prefix is not decoration. Without it, `staff` + `grid` produces `staff-grid` — which is
 * already the class of the container INSIDE a staff section, so `.staff-grid { display: grid }` also
 * matched the <section> and turned the whole section into a one-column grid. `news` + `list` collides
 * with `.news-list` the same way. Any `<type>-<variant>` pair can hit an existing container name, so
 * the whole vocabulary is namespaced rather than the two known collisions being renamed.
 *
 * ⚠️ The first variant of each type emits nothing. It is by definition what that block already
 * rendered as, so a block set to it produces byte-identical HTML to one with no variant at all. */
export function sectionVariantClass(block: Block): string {
  if (block.type === "hero" || block.type === "rich") return "";
  const allowed = variantsFor(block.type);
  if (!block.variant || !allowed.includes(block.variant) || block.variant === allowed[0]) return "";
  return `v-${block.type}-${block.variant}`;
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

/** Picks a layout from item count for the block types the planner never sees.
 *
 * The thresholds are all "below this many rows the table looks emptier than the alternative". Each
 * returns undefined above its threshold, which leaves the type's default (the first value in
 * BLOCK_VARIANTS) — i.e. exactly what these sections rendered as before. */
function layoutForCount(block: Block): string | undefined {
  switch (block.type) {
    case "hours":
      return block.data.rows.length > 0 && block.data.rows.length <= 4 ? "card" : undefined;
    case "faq":
      return block.data.items.length > 0 && block.data.items.length <= 4 ? "open" : undefined;
    case "news":
      return block.data.items.length > 0 && block.data.items.length <= 3 ? "cards" : undefined;
    case "staff":
      return block.data.members.length > 0 && block.data.members.length <= 2 ? "list" : undefined;
    case "pricing":
      return block.data.items.length > 0 && block.data.items.length <= 3 ? "cards" : undefined;
    default:
      return undefined;
  }
}

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

    // Blocks whose content is fact rather than writing (診療時間・料金・スタッフ・お知らせ・FAQ)
    // are never shown to the model at all — see AUTHORABLE_TYPES and HONESTY_RULES. Widening the
    // prompt to let it choose their layout would mean sending a clinic's real hours and prices into
    // a text-generation request, which is exactly what those rules exist to prevent. So their layout
    // is decided here instead, from the one thing that genuinely determines it: how many rows there
    // are. Cheap, deterministic, and incapable of hallucinating.
    variant ??= layoutForCount(block);

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

/** Writes the normalized composition into the document.
 *
 * `cardCount` is stored as well as applied. It used to be discarded on the reasoning that
 * `data.cards.length` already says how many cards there are — true for a generated site, and false
 * for a template, whose cards are sample copy that has to be laid out before any content exists.
 * Keeping it means a rebuild reproduces the shape the planner chose rather than the template's
 * default. It stays advisory: nothing in the renderer reads it (see the note on the schema field). */
export function applyComposition(doc: SiteDocument, composition: Composition): void {
  for (const block of doc.blocks) {
    const entry = composition.get(block.id);
    if (entry?.variant) block.variant = entry.variant;
    if (entry?.cardCount) block.cardCount = entry.cardCount;
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

/** ⚠️ Scoped to one page. `<html data-hero>` drives the hero scroll cue's colour and placement
 * (site.css), so a sub-page reading the whole document would advertise a hero shape it does not
 * have — or any hero at all. Omitting `pageId` keeps the old document-wide behaviour, which is what
 * a one-page document wants. */
export function effectiveHeroLayout(doc: SiteDocument, pageId?: string): HeroLayout {
  const hero = doc.blocks.find(
    (b) => b.type === "hero" && b.visible && (pageId === undefined || b.pageId === pageId)
  );
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
