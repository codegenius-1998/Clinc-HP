import { BLOCK_DEFINITIONS } from "./blocks";
import { newDocumentId } from "./store";
import type { Block, DesignTokens, SiteDocument } from "./document";

/** A template that carries its impact in type and space rather than in photographs.
 *
 * The three templates that existed before this one each ask for about twenty images: four content
 * sections with four photographed cards apiece. That is expensive to generate, slow, and — more to
 * the point — it makes every site look the same, because twenty stock-ish clinic photos are twenty
 * stock-ish clinic photos whatever the clinic. This one asks for five: the hero, one portrait beside
 * the greeting, two interior shots, and the logo.
 *
 * Nothing here needed new rendering machinery. `cardLayout: "minimal"` already renders numbered cards
 * with no image, `freeText` already exists as a photo-free divider, and the three tokens this leans
 * on (`displayScale`, `headingLetterSpacing`, `layout.rule`) were added alongside it. What makes the
 * page work is the arithmetic between them: large headings, wide tracking, generous `spacingScale`,
 * hairline rules, and no shadows or rounded corners anywhere. */

/** Palette: charcoal-green and brass on paper. Every text-on-fill pair clears WCAG AA (the weakest is
 * white on the brass accent at 6.1:1), so this template starts life passing the design check —
 * unlike the stock palette, whose white-on-#4ba3fc button label sits at 2.6:1. */
const COLORS: DesignTokens["colors"] = {
  primary: "#2f3a3f",
  accent: "#6f6046",
  light: "#f5f2ec",
  background: "#ffffff",
  text: "#23282b",
  primaryInverse: "#ffffff",
  accentInverse: "#ffffff",
};

export const TYPOGRAPHIC_DESIGN: DesignTokens = {
  colors: COLORS,
  font: {
    // 明朝 for headings, ゴシック for body. This single pairing does more for the "洗練" the brief
    // asks for than any amount of ornament, and it is the one thing a photo-light page cannot fake.
    headingFamily: '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif',
    bodyFamily: '"Noto Sans JP", -apple-system, "Hiragino Sans", "Yu Gothic", sans-serif',
    googleFonts: ["Shippori+Mincho:wght@500;600", "Noto+Sans+JP:wght@400;500"],
    baseSize: 16,
    lineHeight: 2,
    // 500, not 700: a Mincho headline set bold loses the fine stroke contrast it is chosen for.
    headingWeight: 500,
    displayScale: 1.35,
    headingLetterSpacing: 0.12,
  },
  block: {
    radius: 0,
    borderWidth: 1,
    borderColor: "#e3ded3",
    shadow: "none",
    cardLayout: "minimal",
  },
  layout: {
    heroLayout: "split",
    maxWidth: 1040,
    // The single biggest lever. Space is what this design has instead of photographs.
    spacingScale: 1.6,
    sectionDivider: "none",
    background: "plain",
    decoration: "none",
    rule: "hairline",
  },
  animation: {
    // A quiet fade, slow. Anything with direction would compete with the type for attention, and the
    // sideways variants are what put a horizontal scrollbar on the other templates.
    reveal: "fade",
    duration: 900,
    stagger: true,
    parallaxHero: false,
    variety: false,
  },
};

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

/** `images/placeholder.svg` is written into every rendered site by renderSiteFiles, so a template
 * ships with something that resolves and costs nothing. A real preview replaces these — see
 * scripts/seed-template.mts. Slots meant to stay empty are left as "" so the generator never spends
 * an image on them. */
const PLACEHOLDER = "images/placeholder.svg";

export function typographicTemplateBlocks(): Block[] {
  return [
    block("hero", "hero", "", { image: PLACEHOLDER }),
    // Sets the tone before any information arrives — the page opens with a sentence, not a grid.
    block("philosophy", "freeText", "", { align: "center" }),
    block("news", "news", "お知らせ", { heading: "お知らせ" }),
    // No section image and no card images: `cardLayout: "minimal"` numbers them instead.
    block("department", "rich", "診療案内", { heading: "診療案内", image: "" }),
    // The one section that keeps a photograph. A greeting without a face reads as a notice board.
    block("greeting", "rich", "ご挨拶", { heading: "ご挨拶", image: PLACEHOLDER }),
    block("hours", "hours", "診療時間", { heading: "診療時間" }),
    block("features", "rich", "当院の特徴", { heading: "当院の特徴", image: "" }),
    block("gallery", "gallery", "院内", {
      heading: "院内のご案内",
      columns: 2,
      images: [{ src: PLACEHOLDER }, { src: PLACEHOLDER }],
    }),
    block("staff", "staff", "スタッフ紹介", { heading: "スタッフ紹介" }),
    block("pricing", "pricing", "料金表", { heading: "料金表" }),
    block("faq", "faq", "よくある質問", { heading: "よくある質問" }),
    block("access", "access", "アクセス", { heading: "アクセス" }),
    block("contact", "contact", "お問い合わせ"),
  ];
}

export function buildTypographicTemplate(): SiteDocument {
  const now = new Date().toISOString();
  return {
    id: newDocumentId(),
    slug: "typographic-template",
    name: "余白と明朝の静かなクリニック",
    isTemplate: true,
    canSell: true,
    design: TYPOGRAPHIC_DESIGN,
    // Sample meta, matching how the imported templates present themselves — a preview with an empty
    // header reads as a broken page rather than as a template. `logoImage` is deliberately empty: a
    // template has no logo to show, and the renderer omits the <img> entirely rather than drawing a
    // broken one. Generation always produces a real logo (buildImageJobs guarantees the slot).
    meta: {
      clinicName: "サンプルクリニック",
      phone: "00-0000-0000",
      line: "",
      address: "東京都〇〇区〇〇 1-2-3 〇〇ビル2F",
      logoImage: "",
      seo: {
        title: "余白と明朝の静かなクリニック｜テンプレートプレビュー",
        metaDescription:
          "余白と字間で見せる、写真を最小限に抑えたクリニックサイトのテンプレートです。明朝体の見出しと細い罫線で構成しています。",
        ogTitle: "余白と明朝の静かなクリニック",
        ogDescription: "写真を最小限に抑えた、落ち着いた印象のクリニックサイトテンプレート。",
        ogSiteName: "サンプルクリニック",
      },
      snsLinks: [],
    },
    blocks: typographicTemplateBlocks(),
    // Read by BOTH selectTemplate (to decide which clinic gets this) and generateContentPlan (to set
    // the tone of the copy), so it describes the atmosphere and the fit, not the CSS.
    mood:
      "余白と字間で見せる、静かで洗練された印象。写真は最小限で、院内の空気感だけを担う。明朝体の見出しと細い罫線で構成し、装飾や影は使わない。審美・自由診療、歯科、皮膚科、心療内科など、落ち着いた大人の患者に向けた医院に合う。にぎやかさや親しみやすさより、信頼と品位を優先したい医院向け。",
    tags: ["文字主体", "余白", "上質", "明朝", "落ち着き", "写真少なめ"],
    createdAt: now,
    updatedAt: now,
  };
}
