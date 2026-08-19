import { DEFAULT_DESIGN_TOKENS, type Block, type SiteDocument } from "./document";
import { BLOCK_DEFINITIONS } from "./blocks";
import { newDocumentId } from "./store";

/** The stock clinic layout, used as the fallback template when D1 holds none that fit (a brand-new
 * install, or every template still marked can_sell = 0). It reproduces the section order that
 * hp-templates/SITE_SPEC.json used to hard-code, so a site generated before templates exist looks
 * exactly like one generated after.
 *
 * The four content sections (診療科案内 / ご挨拶 / 特徴 / 施設案内) are all the same `rich` block type
 * — what distinguishes them is their `navLabel` and `heading`, which is also the brief the content
 * planner writes against. That is why an admin can add a fifth content section to a template and the
 * generator will write copy for it without any code change. */

function block<T extends Block["type"]>(
  id: string,
  type: T,
  navLabel: string,
  data: Partial<Record<string, unknown>> = {}
): Block {
  return {
    id,
    type,
    visible: true,
    navLabel,
    data: { ...BLOCK_DEFINITIONS[type].defaultData(), ...data },
  } as Block;
}

/** Stable, readable block ids — these become the page's HTML anchors (`#department`), and a template
 * is a fixed document rather than something the editor generates ids for on the fly. */
export function defaultTemplateBlocks(): Block[] {
  return [
    block("hero", "hero", ""),
    block("news", "news", "お知らせ", { heading: "お知らせ" }),
    block("department", "rich", "診療科案内", { heading: "診療科案内" }),
    block("greeting", "rich", "ご挨拶", { heading: "ご挨拶" }),
    block("features", "rich", "当院の特徴", { heading: "当院の特徴" }),
    block("facility", "rich", "施設案内", { heading: "施設案内" }),
    block("hours", "hours", "診療時間", { heading: "診療時間" }),
    block("staff", "staff", "スタッフ紹介", { heading: "スタッフ紹介" }),
    block("pricing", "pricing", "料金表", { heading: "料金表" }),
    block("faq", "faq", "よくある質問", { heading: "よくある質問" }),
    block("access", "access", "アクセス", { heading: "アクセス" }),
    block("contact", "contact", "お問い合わせ"),
  ];
}

export function buildDefaultTemplate(): SiteDocument {
  const now = new Date().toISOString();
  return {
    id: newDocumentId(),
    slug: "default-template",
    name: "標準クリニックテンプレート",
    isTemplate: true,
    canSell: true,
    design: DEFAULT_DESIGN_TOKENS,
    meta: {
      clinicName: "",
      phone: "",
      line: "",
      address: "",
      logoImage: "images/logo.png",
      seo: { title: "", metaDescription: "", ogTitle: "", ogDescription: "", ogSiteName: "" },
      snsLinks: [],
    },
    blocks: defaultTemplateBlocks(),
    mood: "清潔感があり親しみやすい、オーソドックスなクリニックサイト。専門的すぎず、初めての患者にも安心感を与える柔らかいトーン。幅広い診療科に合う無難な選択肢。",
    tags: ["汎用", "クリニック", "清潔感"],
    createdAt: now,
    updatedAt: now,
  };
}
