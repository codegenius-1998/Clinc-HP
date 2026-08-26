import { blockLabel, blockSummary } from "./blocks";
import { effectiveCardLayout } from "./composition";
import type { Block, DesignTokens, SiteDocument } from "./document";

/** The single enumeration of "every place a SiteDocument points at an image".
 *
 * This exists because the same list was previously written out three times — once to decide what to
 * generate (buildImageJobs), once to write the results back (applyImagePaths), and once more in the
 * head of whoever was checking the result by hand. They drifted, and the gap between the first two is
 * exactly how three of five generated sites shipped with `images/greeting.jpg` in the document and no
 * such file on disk. Anything that needs to reason about a document's images walks this instead, so a
 * new block type with an image is added in one place or not at all. */

export const LOGO_SLOT = "logo";

/** The generated photograph behind the page (`design.layout.backdrop`).
 *
 * ⚠️ It is listed here rather than being a field on some block, and that is the whole point: this
 * module is the single ledger of "every place a document points at an image". Adding the slot here
 * gives buildImageJobs' gap-filling, checkImages' file-existence rule and
 * scripts/illustrate-template.mts the backdrop for free — which is the arrangement BUG-01 taught. */
export const BACKDROP_SLOT = "backdrop";

export type ImageAspect = "1:1" | "4:3" | "16:9" | "2:1";

/** Slot keys address one image placement: a block's own image, or the nth item inside it. They double
 * as output filenames, so they're kept to characters that are safe in a path and in a URL. */
export function slotKey(blockId: string, index?: number): string {
  const base = index === undefined ? blockId : `${blockId}-${index}`;
  return base.replace(/[^A-Za-z0-9_-]/g, "-");
}

/** True when a path can only resolve if the generator writes the file itself. Absolute URLs (an
 * uploaded photo on Supabase) and root-relative paths (anything already under public/) live outside
 * the site directory and survive on their own; a bare "images/foo.jpg" does not — and generateSite
 * wipes that directory at the start of every run. */
export function needsGeneratedFile(value: string | undefined): boolean {
  if (!value) return false;
  return !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value);
}

export type ImageSlot = {
  slot: string;
  /** Field path inside the block, in the same convention as the renderer's `data-field` attribute. */
  field: string;
  /** What the document currently stores here. Empty string when the slot is unfilled. */
  value: string;
  /** Human-readable location, for check messages and the editor. */
  label: string;
  aspect: ImageAspect;
  /** False when the design never draws this slot — `cardLayout: "minimal"` renders no card image at
   * all, so generating one would be a billed API call for a file no `<img>` points at. */
  rendered: boolean;
};

type CardLayout = DesignTokens["block"]["cardLayout"];

function where(block: Block, field: string): string {
  return `${blockLabel(block.type)}「${blockSummary(block)}」/ ${field}`;
}

/** Every image placement inside one block, whether filled or not. */
export function blockImageSlots(block: Block, cardLayout: CardLayout): ImageSlot[] {
  const own = slotKey(block.id);
  switch (block.type) {
    case "hero":
      return [
        {
          slot: own,
          field: "image",
          value: block.data.image,
          label: where(block, "背景画像"),
          aspect: "2:1",
          rendered: true,
        },
      ];

    case "rich": {
      const slots: ImageSlot[] = [
        {
          slot: own,
          field: "image",
          value: block.data.image ?? "",
          label: where(block, "セクション画像"),
          aspect: "4:3",
          rendered: true,
        },
      ];
      block.data.cards.forEach((card, i) => {
        slots.push({
          slot: slotKey(block.id, i),
          field: `cards.${i}.image`,
          value: card.image ?? "",
          label: where(block, `カード${i + 1}の画像`),
          aspect: "4:3",
          rendered: cardLayout !== "minimal",
        });
      });
      return slots;
    }

    case "imageBanner":
      return [
        {
          slot: own,
          field: "image",
          value: block.data.image,
          label: where(block, "画像"),
          aspect: "2:1",
          rendered: true,
        },
      ];

    case "gallery":
      return block.data.images.map((image, i) => ({
        slot: slotKey(block.id, i),
        field: `images.${i}.src`,
        value: image.src,
        label: where(block, `写真${i + 1}`),
        aspect: "4:3",
        rendered: true,
      }));

    case "staff":
      return block.data.members.map((member, i) => ({
        slot: slotKey(block.id, i),
        field: `members.${i}.image`,
        value: member.image ?? "",
        label: where(block, `${member.name || `スタッフ${i + 1}`}の写真`),
        aspect: "1:1",
        rendered: true,
      }));

    default:
      return [];
  }
}

/** Every image placement in a document, header logo included.
 *
 * Hidden blocks are skipped by default: they render nothing, so a stale path inside one is not a
 * defect and generating a photo for one would be money spent on an invisible section. */
export function documentImageSlots(
  doc: SiteDocument,
  options: { includeHidden?: boolean } = {}
): ImageSlot[] {
  const slots: ImageSlot[] = [
    {
      slot: LOGO_SLOT,
      field: "meta.logoImage",
      value: doc.meta.logoImage,
      label: "ヘッダー / ロゴ",
      aspect: "1:1",
      rendered: true,
    },
  ];
  // Only when the design asks for one. A template that does not use a backdrop must not be billed
  // for a photograph nothing draws — the same rule `rendered` expresses for card images.
  if (doc.design.layout.backdrop !== "none") {
    slots.push({
      slot: BACKDROP_SLOT,
      field: "design.layout.backdropImage",
      value: doc.design.layout.backdropImage,
      label: "ページ背景の写真",
      aspect: "16:9",
      rendered: true,
    });
  }
  for (const block of doc.blocks) {
    if (!block.visible && !options.includeHidden) continue;
    // Per block, not per document: a section may override the template's card layout (see
    // composition.ts), and "minimal" is the difference between generating four photographs and none.
    slots.push(...blockImageSlots(block, effectiveCardLayout(block, doc.design)));
  }
  return slots;
}
