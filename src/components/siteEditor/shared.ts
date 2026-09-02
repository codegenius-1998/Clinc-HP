import type { SiteTemplate, CustomBlock, CustomBlockKind } from "@/lib/generatedSite/types";

/** Constants and pure helpers shared by the site-editor overview page and the per-section pages.
 * No React, no "use client" — safe to import from server components too (route pages use
 * `sectionLabel` to build the page title and validate the section id). */

export const SECTION_LABELS: Record<string, string> = {
  hero: "ファーストビュー",
  greeting: "当院について",
  medical: "診療案内",
  philosophy: "当院の想い",
  gallery: "院内のようす",
  schedule: "診療時間",
  fees: "料金の目安",
  flow: "受診の流れ",
  faq: "よくあるご質問",
  news: "お知らせ",
  access: "アクセス",
  contact: "お問い合わせ",
};

export const ALL_SECTIONS = Object.keys(SECTION_LABELS);

/** Sections whose copy the "AIで再生成" button can rewrite. */
export const REGENERATABLE = new Set([
  "hero", "greeting", "medical", "philosophy", "gallery", "faq", "flow", "contact",
]);

export const CUSTOM_KIND_LABEL: Record<CustomBlockKind, string> = {
  text: "テキスト",
  image: "画像",
  grid: "グリッド",
};

export const CUSTOM_KIND_HINT: Record<CustomBlockKind, string> = {
  text: "見出しと文章だけの自由なセクション",
  image: "写真を横並びに並べるセクション",
  grid: "見出し＋説明＋画像のカードを格子状に並べる",
};

export const COLOR_KEYS: [keyof SiteTemplate["theme"]["colors"], string][] = [
  ["primary", "プライマリ"],
  ["primaryDeep", "プライマリ（濃）"],
  ["accent", "アクセント（ボタン）"],
  ["tint", "淡色の地"],
  ["paper", "背景（紙）"],
  ["ink", "本文"],
  ["inkSoft", "本文（淡）"],
  ["line", "罫線"],
];

export const WASH_KEYS: [keyof SiteTemplate["theme"]["washes"], string][] = [
  ["pink", "ピンク"],
  ["blue", "ブルー"],
  ["yellow", "イエロー"],
  ["peach", "ピーチ"],
  ["mint", "ミント"],
];

export function newCustomBlock(kind: CustomBlockKind, id: string): CustomBlock {
  if (kind === "text") {
    return { id, kind: "text", heading: { ja: "見出し", en: "Section" }, align: "left", body: ["ここに本文を入力します。"] };
  }
  if (kind === "image") {
    return { id, kind: "image", heading: { ja: "見出し", en: "Photos" }, caption: "", images: [{ src: null, alt: "" }] };
  }
  return {
    id,
    kind: "grid",
    heading: { ja: "見出し", en: "Grid" },
    columns: 3,
    items: [{ title: "項目名", body: "説明文を入力します。", image: { src: null, alt: "" } }],
  };
}

/** Human label for a section id (built-in name, or "テキスト｜<heading>" for a custom block). */
export function sectionTitle(template: SiteTemplate, id: string): string {
  if (SECTION_LABELS[id]) return SECTION_LABELS[id];
  const b = template.customBlocks.find((x) => x.id === id);
  return b ? `${CUSTOM_KIND_LABEL[b.kind]}｜${b.heading.ja || "無題"}` : id;
}

/** Whether `id` is a section that currently exists on the site (in the layout). */
export function sectionExists(template: SiteTemplate, id: string): boolean {
  return template.layout.some((l) => l.id === id);
}
