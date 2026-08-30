/** The structured content of one generated clinic site — the shape OpenAI is asked to produce and
 * the shape `render.ts` consumes. It mirrors `public/_generated/hidamari-hifuka/template.json`.
 *
 * Everything is deep-optional here: the model's output is coerced to a complete `SiteTemplate` by
 * `normalize.ts` before it reaches the renderer, so the renderer can assume required fields exist. */

export type ImageSlot = { src: string | null; alt: string };
export type Heading = { ja: string; en: string };
export type NavItem = { href: string; label: string };

export type ThemeColors = {
  primary: string;
  primaryDeep: string;
  accent: string;
  tint: string;
  paper: string;
  ink: string;
  inkSoft: string;
  line: string;
};

export type ThemeWashes = {
  pink: string;
  blue: string;
  yellow: string;
  peach: string;
  mint: string;
};

export type ThemeFonts = {
  /** A valid https://fonts.googleapis.com/css2?... URL for the two families below. */
  googleHref: string;
  /** Full CSS font-family stack incl. Japanese fallbacks, e.g. `"Klee One", "Yu Gothic", serif`. */
  heading: string;
  body: string;
  headingTracking: string;
};

export type Theme = {
  colors: ThemeColors;
  washes: ThemeWashes;
  botanicalStroke: string;
  fonts: ThemeFonts;
  /** Global type-size multiplier applied to the page root (`html { font-size }`). 1 = default.
   * The editor exposes this as a 0.9–1.15 slider; the renderer only emits an override when ≠ 1. */
  fontScale: number;
};

export type LayoutItem = { id: string; kind: string };

export type MedicalItem = { icon: string; ja: string; en: string; lead: string };
export type GalleryItem = { image: ImageSlot; caption: string };
export type ScheduleRow = { label: string; marks: (string | null)[] };
export type FeeGroup = { group: string; items: { name: string; price: string; note?: string }[] };
export type FlowStep = { no: string; title: string; body: string };
export type FaqItem = { q: string; a: string };
export type NewsItem = { date: string; title: string };
export type AccessInfo = { term: string; lines: string[] };

export type Sections = {
  hero: {
    image: ImageSlot;
    tagline: string;
    headline: string[];
    sub: string;
    bubbles: string[];
  };
  greeting: {
    heading: Heading;
    image: ImageSlot;
    doctorName: string;
    doctorRole: string;
    message: string[];
  };
  medical: {
    heading: Heading;
    intro: string;
    items: MedicalItem[];
    conditions: string[];
  };
  philosophy: { heading: Heading; lead: string; body: string[] };
  gallery: { heading: Heading; intro: string; items: GalleryItem[] };
  schedule: {
    heading: Heading;
    cornerLabel: string;
    days: string[];
    rows: ScheduleRow[];
    notes: string[];
  };
  fees: { heading: Heading; disclaimer: string; groups: FeeGroup[] };
  flow: { heading: Heading; steps: FlowStep[] };
  faq: { heading: Heading; items: FaqItem[] };
  news: { heading: Heading; items: NewsItem[] };
  access: {
    heading: Heading;
    image: ImageSlot;
    points: string[];
    info: AccessInfo[];
  };
  contact: {
    heading: Heading;
    lead: string;
    reserveLabel: string;
    phoneCaption: string;
    note: string;
  };
  footer: { nav: NavItem[]; copyright: string };
};

export type SiteTemplate = {
  meta: { title: string; description: string };
  theme: Theme;
  brand: { name: string; nameEn: string; logo: null };
  contact: {
    phone: string;
    phoneCaption: string;
    reserveUrl: string;
    reserveLabel: string;
    address: string;
  };
  layout: LayoutItem[];
  nav: NavItem[];
  sections: Sections;
};

/** Section ids the renderer knows how to draw. `layout` entries with any other id are skipped. */
export const KNOWN_SECTION_IDS = [
  "hero",
  "greeting",
  "medical",
  "philosophy",
  "gallery",
  "schedule",
  "fees",
  "flow",
  "faq",
  "news",
  "access",
  "contact",
] as const;
