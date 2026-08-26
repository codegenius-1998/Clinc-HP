import { BLOCK_DEFINITIONS } from "./blocks";
import { HOME_PAGE_ID, type Block, type BlockType, type PageDef } from "./document";

/** The block plans a template can be built from — "what sections, on what pages, in what order".
 *
 * This exists because every template shipped with the SAME twelve sections in the same order with
 * four cards apiece. Both importers hardcoded `applySampleCopy(defaultTemplateBlocks())`, so a
 * template imported from a reference site took its palette and its typography from that site and its
 * entire skeleton from a constant. Four templates that differed only in colour is the direct result.
 *
 * ⚠️ The archetype key is NOT stored on the document. These are build-time generators: the `pages`
 * and `blocks` arrays they produce ARE the truth, and an admin who adds one section in the editor
 * would immediately make a stored key a lie. Anything that needs to know "what shape is this" should
 * read the blocks.
 *
 * ⚠️ Nothing here invents a layout. Every `variant` below is a value from composition.ts's
 * BLOCK_VARIANTS, and every `cardCount` is inside CARD_COUNT_RANGE — the same closed vocabulary the
 * content planner is held to. What varies between archetypes is which sections exist, how they are
 * grouped into pages, and how many cards each holds. */

export type BlockPlanEntry = {
  /** Stable, readable — it becomes the HTML anchor and (via slotKey) the generated image filename,
   * so it must be unique across the WHOLE document, not just within its page. */
  id: string;
  type: BlockType;
  navLabel: string;
  variant?: string;
  cardCount?: number;
  /** Merged over the type's `defaultData()`. Used only for headings, which are what distinguishes
   * four `rich` sections from each other. */
  data?: Record<string, unknown>;
};

export type PagePlan = {
  id: string;
  path: string;
  navLabel: string;
  title?: string;
  blocks: BlockPlanEntry[];
};

export type ArchetypeKey =
  | "one-page-classic"
  | "one-page-editorial"
  | "multi-page-clinic"
  | "landing-lite";

export type Archetype = {
  key: ArchetypeKey;
  label: string;
  /** Shown in the admin's import form, and (in Phase 4) to the model choosing between them. */
  description: string;
  pages: PagePlan[];
};

const rich = (id: string, heading: string, extra: Partial<BlockPlanEntry> = {}): BlockPlanEntry => ({
  id,
  type: "rich",
  navLabel: heading,
  data: { heading },
  ...extra,
});

const plain = (id: string, type: BlockType, extra: Partial<BlockPlanEntry> = {}): BlockPlanEntry => ({
  id,
  type,
  navLabel: BLOCK_DEFINITIONS[type].defaultNavLabel,
  ...extra,
});

/** The twelve-section single page every template used to be. Kept first and kept exact: it is the
 * identity element, and "this archetype reproduces what we shipped before" is a property worth being
 * able to check rather than to remember. */
const ONE_PAGE_CLASSIC: PagePlan[] = [
  {
    id: HOME_PAGE_ID,
    path: "",
    navLabel: "ホーム",
    blocks: [
      plain("hero", "hero"),
      plain("news", "news", { data: { heading: "お知らせ" } }),
      rich("department", "診療科案内", { cardCount: 4 }),
      rich("greeting", "ご挨拶", { cardCount: 4 }),
      rich("features", "当院の特徴", { cardCount: 4 }),
      rich("facility", "施設案内", { cardCount: 4 }),
      plain("hours", "hours", { data: { heading: "診療時間" } }),
      plain("staff", "staff", { data: { heading: "スタッフ紹介" } }),
      plain("pricing", "pricing", { data: { heading: "料金表" } }),
      plain("faq", "faq", { data: { heading: "よくある質問" } }),
      plain("access", "access", { data: { heading: "アクセス" } }),
      plain("contact", "contact"),
    ],
  },
];

/** Text-led, photo-light — the shape typographicTemplate.ts already had, reproduced here exactly.
 *
 * ⚠️ "Exactly" is checked, not assumed: scripts/verify-archetypes.mts compares this against the
 * literal block list this replaced. The seeded `typographic-template` carries seven real generated
 * photographs whose filenames come from these block ids, so a drifted id would leave that template
 * pointing at images that no longer exist.
 *
 * Note what is NOT set here: no `variant` on hero, and none on the `minimal` card sections. This
 * archetype's template already carries `heroLayout: "split"` and `cardLayout: "minimal"` as
 * document-wide tokens, and a per-block variant would override rather than agree with them — pinning
 * a section to "minimal" even if the admin later changed the template's own card layout. */
const PLACEHOLDER = "images/placeholder.svg";

const ONE_PAGE_EDITORIAL: PagePlan[] = [
  {
    id: HOME_PAGE_ID,
    path: "",
    navLabel: "ホーム",
    blocks: [
      plain("hero", "hero", { data: { image: PLACEHOLDER } }),
      // Sets the tone before any information arrives — the page opens with a sentence, not a grid.
      { id: "philosophy", type: "freeText", navLabel: "", data: { align: "center" } },
      plain("news", "news", { data: { heading: "お知らせ" } }),
      // No section image and no card images: the template's "minimal" card layout numbers them.
      rich("department", "診療案内", { cardCount: 4, data: { heading: "診療案内", image: "" } }),
      // The one section that keeps a photograph. A greeting without a face reads as a notice board.
      rich("greeting", "ご挨拶", { cardCount: 4, data: { heading: "ご挨拶", image: PLACEHOLDER } }),
      plain("hours", "hours", { data: { heading: "診療時間" } }),
      rich("features", "当院の特徴", { cardCount: 4, data: { heading: "当院の特徴", image: "" } }),
      plain("gallery", "gallery", {
        navLabel: "院内",
        data: { heading: "院内のご案内", columns: 2, images: [{ src: PLACEHOLDER }, { src: PLACEHOLDER }] },
      }),
      plain("staff", "staff", { data: { heading: "スタッフ紹介" } }),
      plain("pricing", "pricing", { data: { heading: "料金表" } }),
      plain("faq", "faq", { data: { heading: "よくある質問" } }),
      plain("access", "access", { data: { heading: "アクセス" } }),
      plain("contact", "contact"),
    ],
  },
];

/** Five real pages, in the shape a clinic's own site conventionally takes. The contact section sits
 * on the アクセス page rather than on every page — designCheck requires one per SITE, precisely so
 * this arrangement is allowed. */
const MULTI_PAGE_CLINIC: PagePlan[] = [
  {
    id: HOME_PAGE_ID,
    path: "",
    navLabel: "ホーム",
    blocks: [
      plain("hero", "hero"),
      plain("news", "news", { data: { heading: "お知らせ" } }),
      rich("department", "診療案内", { cardCount: 3 }),
      rich("features", "当院の特徴", { variant: "minimal", cardCount: 3 }),
      plain("hours", "hours", { data: { heading: "診療時間" } }),
    ],
  },
  {
    id: "about",
    path: "about",
    navLabel: "当院について",
    blocks: [
      rich("greeting", "ご挨拶", { variant: "list", cardCount: 2 }),
      plain("staff", "staff", { data: { heading: "スタッフ紹介" } }),
      rich("facility", "施設案内", { cardCount: 4 }),
    ],
  },
  {
    id: "service",
    path: "service",
    navLabel: "診療案内",
    blocks: [
      rich("service-detail", "診療内容", { cardCount: 4 }),
      plain("pricing", "pricing", { data: { heading: "料金表" } }),
      plain("faq", "faq", { data: { heading: "よくある質問" } }),
    ],
  },
  {
    id: "access",
    path: "access",
    navLabel: "アクセス",
    blocks: [
      plain("access", "access", { data: { heading: "アクセス" } }),
      plain("hours-access", "hours", { navLabel: "", data: { heading: "診療時間" } }),
      plain("contact", "contact"),
    ],
  },
];

/** Short and image-light: six sections on one page, with `overlap` cards and a gallery doing the
 * work four photographed content sections used to. About half the images of the classic. */
const LANDING_LITE: PagePlan[] = [
  {
    id: HOME_PAGE_ID,
    path: "",
    navLabel: "ホーム",
    blocks: [
      plain("hero", "hero", { variant: "centered" }),
      { id: "philosophy", type: "freeText", navLabel: "", data: { heading: "", align: "center" } },
      rich("department", "診療案内", { variant: "overlap", cardCount: 3 }),
      plain("hours", "hours", { data: { heading: "診療時間" } }),
      plain("gallery", "gallery", { data: { heading: "院内のご案内", columns: 3 } }),
      plain("access", "access", { data: { heading: "アクセス" } }),
      plain("contact", "contact"),
    ],
  },
];

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  "one-page-classic": {
    key: "one-page-classic",
    label: "1ページ・標準",
    description: "12セクションを1枚に収めた、いちばん情報量の多い形。写真を多く使います。",
    pages: ONE_PAGE_CLASSIC,
  },
  "one-page-editorial": {
    key: "one-page-editorial",
    label: "1ページ・文字主体",
    description: "余白と字間で見せる、写真の少ない形。カードは番号と文字だけで組みます。",
    pages: ONE_PAGE_EDITORIAL,
  },
  "multi-page-clinic": {
    key: "multi-page-clinic",
    label: "複数ページ・クリニック標準",
    description: "トップ／当院について／診療案内／アクセスの4ページ。医院のサイトで最も一般的な形。",
    pages: MULTI_PAGE_CLINIC,
  },
  "landing-lite": {
    key: "landing-lite",
    label: "1ページ・軽量",
    description: "6セクションだけの短い1枚。画像の枚数と生成時間を抑えたいときに。",
    pages: LANDING_LITE,
  },
};

export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES) as ArchetypeKey[];

export function isArchetypeKey(value: string): value is ArchetypeKey {
  return value in ARCHETYPES;
}

/** Expands an archetype into the `pages` and `blocks` a SiteDocument needs.
 *
 * The blocks come back in ONE flat array in page order — the shape the document actually stores —
 * so callers can hand the result straight to `applySampleCopy` and then to the document literal. */
export function archetypeBlocks(key: ArchetypeKey): { pages: PageDef[]; blocks: Block[] } {
  const archetype = ARCHETYPES[key];
  const pages: PageDef[] = [];
  const blocks: Block[] = [];
  const usedIds = new Set<string>();

  for (const page of archetype.pages) {
    pages.push({
      id: page.id,
      path: page.path,
      navLabel: page.navLabel,
      title: page.title ?? "",
      metaDescription: "",
      inNav: true,
    });

    for (const entry of page.blocks) {
      // ⚠️ Document-wide, not per page. `slotKey(blockId, i)` doubles as the generated image's
      // FILENAME and every page shares one images/ directory, so two pages each holding a block
      // called "hours" would overwrite each other's photograph.
      if (usedIds.has(entry.id)) continue;
      usedIds.add(entry.id);

      blocks.push({
        id: entry.id,
        type: entry.type,
        visible: true,
        navLabel: entry.navLabel,
        pageId: page.id,
        ...(entry.variant ? { variant: entry.variant } : {}),
        ...(entry.cardCount ? { cardCount: entry.cardCount } : {}),
        data: { ...BLOCK_DEFINITIONS[entry.type].defaultData(), ...(entry.data ?? {}) },
      } as Block);
    }
  }

  return { pages, blocks };
}
