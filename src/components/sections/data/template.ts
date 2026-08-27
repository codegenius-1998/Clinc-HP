import type { CSSProperties } from "react";
import raw from "./template.json";

/** テンプレートの単一データソース。すべての文言・画像・フォント・カラーは
 * `data/template.json` にあり、ここで型を付けて配布する。別サイトを作るときは JSON を
 * 差し替えるだけ(コンポーネントは触らない)。
 *
 * - `themeStyle` … `.nj-site` に載せるインライン CSS 変数(色・フォント)。site.css の既定値を上書きする。
 * - `fontHref`   … Google Fonts の <link> href(JSON の theme.fonts から組み立て)。
 * - `content`    … セクションごとの中身(見出し・本文・画像スロット)。
 * - `clinic` / `treatments` … 既存セクションが使っている従来の形(JSON から組み直したもの)。 */

// --- section layout ------------------------------------------------------------

export type SectionType =
  | "header"
  | "hero"
  | "schedule"
  | "news"
  | "reasons"
  | "greeting"
  | "philosophy"
  | "medical"
  | "fees"
  | "flow"
  | "faq"
  | "access"
  | "contact"
  | "footer";

export type SectionConfig = { type: SectionType; variant: string };

export const layout = raw.layout as SectionConfig[];

// --- shared shapes -----------------------------------------------------------

export type Heading = { ja: string; en: string };
export type ImageSlot = { src: string | null; alt: string };
export type NavItem = { href: string; ja: string; en: string };
export type LinkItem = { href: string; label: string };

export type Content = {
  hero: { image: ImageSlot; headlineLines: string[]; sub: string; reserveLabel: string };
  schedule: {
    heading: Heading;
    cornerLabel: string;
    emptyMark: string;
    days: string[];
    rows: { label: string; marks: (string | null)[] }[];
    notes: string[];
  };
  news: { heading: Heading; items: { date: string; title: string }[] };
  reasons: {
    heading: Heading;
    items: { no: string; icon: string; title: string; body: string }[];
  };
  greeting: {
    heading: Heading;
    image: ImageSlot;
    doctorName: string;
    doctorRole: string;
    message: string[];
  };
  philosophy: { heading: Heading; lead: string; body: string[] };
  medical: {
    heading: Heading;
    items: { key: string; icon: string; ja: string; en: string; lead: string }[];
  };
  fees: {
    heading: Heading;
    disclaimer: string;
    groups: { group: string; items: { name: string; price: string; note?: string }[] }[];
  };
  flow: { heading: Heading; steps: { no: string; title: string; body: string }[] };
  faq: { heading: Heading; items: { q: string; a: string }[] };
  access: {
    heading: Heading;
    image: ImageSlot;
    points: string[];
    info: { term: string; lines: string[] }[];
  };
  contact: {
    heading: Heading;
    lead: string;
    reserveLabel: string;
    phoneCaption: string;
    note: string;
  };
  footer: { nav: LinkItem[]; copyright: string };
};

export const meta = raw.meta as { title: string; description: string };
export const brand = raw.brand as { name: string; nameEn: string; logo: ImageSlot };
export const site = raw.contact as {
  phone: string;
  phoneCaption: string;
  reserveUrl: string;
  reserveLabel: string;
  address: string;
};
export const nav = raw.nav as NavItem[];
export const actionBar = raw.header.actionBar as LinkItem[];
export const content = raw.sections as unknown as Content;

// --- theme → CSS custom properties + font <link> --------------------------

const col = raw.theme.colors;
const fonts = raw.theme.fonts;

export const themeStyle = {
  "--nj-primary": col.primary,
  "--nj-primary-deep": col.primaryDeep,
  "--nj-accent": col.accent,
  "--nj-tint": col.tint,
  "--nj-paper": col.paper,
  "--nj-ink": col.ink,
  "--nj-ink-soft": col.inkSoft,
  "--nj-line": col.line,
  "--nj-font-head": `"${fonts.heading.family}", ${fonts.heading.fallback}`,
  "--nj-font-body": `"${fonts.body.family}", ${fonts.body.fallback}`,
  "--nj-head-tracking": fonts.headingTracking,
} as CSSProperties;

export const fontHref: string | null = fonts.useGoogleFonts
  ? "https://fonts.googleapis.com/css2?" +
    [fonts.heading, fonts.body]
      .map((x) => `family=${x.family.replace(/ /g, "+")}:wght@${x.weights.join(";")}`)
      .join("&") +
    "&display=swap"
  : null;

// --- back-compat shapes for the existing section components -----------------

export type Clinic = {
  name: string;
  nameEn: string;
  phone: string;
  lineUrl: string;
  address: string;
  hours: Content["schedule"];
  news: Content["news"]["items"];
  reasons: Content["reasons"]["items"];
  doctor: { name: string; role: string; message: string[] };
  philosophy: string[];
  fees: Content["fees"]["groups"];
  flow: Content["flow"]["steps"];
  faq: Content["faq"]["items"];
  access: string[];
};

export const clinic: Clinic = {
  name: brand.name,
  nameEn: brand.nameEn,
  phone: site.phone,
  lineUrl: site.reserveUrl,
  address: site.address,
  hours: content.schedule,
  news: content.news.items,
  reasons: content.reasons.items,
  doctor: {
    name: content.greeting.doctorName,
    role: content.greeting.doctorRole,
    message: content.greeting.message,
  },
  philosophy: [content.philosophy.lead, ...content.philosophy.body],
  fees: content.fees.groups,
  flow: content.flow.steps,
  faq: content.faq.items,
  access: content.access.points,
};

export type Treatment = Content["medical"]["items"][number];
export const treatments: Treatment[] = content.medical.items;

/** `早めに*気づいて*、` → ["早めに", <em>気づいて</em>, "、"] のためのトークン分割。 */
export function splitEmphasis(line: string): { text: string; em: boolean }[] {
  return line.split(/\*([^*]+)\*/).map((part, i) => ({ text: part, em: i % 2 === 1 }));
}
