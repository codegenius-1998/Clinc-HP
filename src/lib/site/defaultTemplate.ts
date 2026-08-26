import { archetypeBlocks } from "./archetypes";
import { DEFAULT_DESIGN_TOKENS, defaultPages, type Block, type SiteDocument } from "./document";
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

/** The stock twelve-section layout, now expressed as the `one-page-classic` archetype.
 *
 * ⚠️ Kept as a function rather than inlined at its call sites: `blockLabel`-stable ids and this exact
 * section order are what every existing template on disk was built from, and scripts/verify-archetypes.mts
 * checks that the archetype still reproduces it. */
export function defaultTemplateBlocks(): Block[] {
  return archetypeBlocks("one-page-classic").blocks;
}

export function buildDefaultTemplate(): SiteDocument {
  const now = new Date().toISOString();
  return {
    id: newDocumentId(),
    slug: "default-template",
    name: "標準クリニックテンプレート",
    isTemplate: true,
    canSell: true,
    // ⚠️ A copy, not the constant. DEFAULT_DESIGN_TOKENS is a shared mutable object, and a document
    // holding it by reference lets any writer corrupt the defaults for the whole process — which is
    // no longer hypothetical: applyImagePaths writes design.layout.backdropImage. Same reasoning as
    // defaultPages() being a function rather than a constant (document.ts).
    design: structuredClone(DEFAULT_DESIGN_TOKENS),
    meta: {
      clinicName: "",
      phone: "",
      line: "",
      address: "",
      logoImage: "images/logo.png",
      seo: { title: "", metaDescription: "", ogTitle: "", ogDescription: "", ogSiteName: "" },
      snsLinks: [],
    },
    // One page, as every document was before multi-page rendering existed.
    pages: defaultPages(),
    blocks: defaultTemplateBlocks(),
    mood: "清潔感があり親しみやすい、オーソドックスなクリニックサイト。専門的すぎず、初めての患者にも安心感を与える柔らかいトーン。幅広い診療科に合う無難な選択肢。",
    tags: ["汎用", "クリニック", "清潔感"],
    createdAt: now,
    updatedAt: now,
  };
}
