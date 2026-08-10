import type { ColorTheme } from "@/lib/designPresets";

export type SectionBlockView = { heading: string; body: string; image?: string };

/** One AI-authored body section (department / greeting / features / facility), fully resolved:
 * text already decided by the content plan, image paths already resolved to local generated files. */
export type SectionView = {
  id: string;
  label: string;
  heading: string;
  body: string;
  blocks: SectionBlockView[];
  image?: string;
};

export type NavItem = { id: string; label: string };

export type HoursRow = { label: string; value: string };
export type NewsItem = { date: string; title: string };
export type FaqItem = { question: string; answer: string };
export type PriceItem = { name: string; price: string; note?: string };
export type StaffMember = { name: string; role?: string; comment: string; image?: string };

/** Everything the renderer needs, fully resolved — no further decisions (visibility, order, real vs.
 * AI-fallback data, image file paths) are made inside the React components themselves. Assembled by
 * siteGenerator.ts from the hearing sheet + SITE_SPEC.json + the AI content plan. */
export type SiteViewModel = {
  clinicName: string;
  phone?: string;
  line?: string;
  address?: string;
  mapQuery?: string;
  logoImage: string;
  heroImage: string;
  heroHeadline: string;
  heroSubheadline?: string;
  theme: ColorTheme;
  fontFamily: "sans" | "serif";
  cardStyle: "rounded" | "sharp";
  heroLayout: "full-bleed" | "split";
  blockLayout: "grid" | "list" | "minimal";
  spacing: "compact" | "spacious";
  seo: { title: string; metaDescription: string; ogTitle: string; ogDescription: string; ogSiteName: string };
  navItems: NavItem[];
  aiSections: SectionView[];
  hours: { visible: boolean; rows: HoursRow[] };
  access: { visible: boolean };
  news: { visible: boolean; items: NewsItem[] };
  staff: { visible: boolean; members: StaffMember[] };
  faq: { visible: boolean; items: FaqItem[] };
  pricing: { visible: boolean; items: PriceItem[] };
  snsLinks: { label: string; href: string }[];
};
