/** Coerces the raw JSON object OpenAI returns into a complete `SiteTemplate`. The model is asked
 * for the right shape but not trusted to deliver it: every field is validated and defaulted here so
 * `render.ts` can assume a fully-populated template. */

import type {
  SiteTemplate,
  ImageSlot,
  Heading,
  NavItem,
  ThemeColors,
  ThemeWashes,
} from "./types";
import { KNOWN_SECTION_IDS } from "./types";

const FALLBACK_COLORS: ThemeColors = {
  primary: "#7aa9d8",
  primaryDeep: "#4f7aa6",
  accent: "#dd93b0",
  tint: "#f8f3ea",
  paper: "#fffdf8",
  ink: "#4a453f",
  inkSoft: "#8b8579",
  line: "#ece3d2",
};

const FALLBACK_WASHES: ThemeWashes = {
  pink: "#f2cdd6",
  blue: "#c9dcee",
  yellow: "#f3e7b6",
  peach: "#f4d6c0",
  mint: "#d0e4d8",
};

const FALLBACK_GOOGLE_HREF =
  "https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";
const FALLBACK_HEAD_FONT = '"Klee One", "Hiragino Maru Gothic ProN", "Yu Gothic", serif';
const FALLBACK_BODY_FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif';

const MEDICAL_ICONS = new Set([
  "skin", "child", "sparkle", "care", "tooth", "eye", "bone", "heart", "allergy", "general",
]);

// --- primitive coercers ------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return out.length ? out : fallback;
}

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback;
}

function heading(v: unknown, ja: string, en: string): Heading {
  const r = isRecord(v) ? v : {};
  return { ja: str(r.ja, ja), en: str(r.en, en) };
}

function imageSlot(v: unknown, alt: string): ImageSlot {
  const r = isRecord(v) ? v : {};
  const src = typeof r.src === "string" && r.src.trim() ? r.src.trim() : null;
  return { src, alt: str(r.alt, alt) };
}

function navItems(v: unknown, fallback: NavItem[]): NavItem[] {
  if (!Array.isArray(v)) return fallback;
  const out: NavItem[] = [];
  for (const x of v) {
    if (!isRecord(x)) continue;
    const href = str(x.href);
    const label = str(x.label);
    if (href.startsWith("#") && label) out.push({ href, label });
  }
  return out.length ? out : fallback;
}

// --- section defaults ------------------------------------------------------

function objArray<T>(v: unknown, map: (r: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    if (!isRecord(x)) continue;
    const mapped = map(x);
    if (mapped) out.push(mapped);
  }
  return out;
}

// --- main ------------------------------------------------------------------

export function normalizeTemplate(raw: unknown, brandNameFallback: string): SiteTemplate {
  const r = isRecord(raw) ? raw : {};
  const rMeta = isRecord(r.meta) ? r.meta : {};
  const rTheme = isRecord(r.theme) ? r.theme : {};
  const rColors = isRecord(rTheme.colors) ? rTheme.colors : {};
  const rWashes = isRecord(rTheme.washes) ? rTheme.washes : {};
  const rFonts = isRecord(rTheme.fonts) ? rTheme.fonts : {};
  const rBrand = isRecord(r.brand) ? r.brand : {};
  const rContact = isRecord(r.contact) ? r.contact : {};
  const rSections = isRecord(r.sections) ? r.sections : {};

  const brandName = str(rBrand.name, brandNameFallback);

  const colors: ThemeColors = {
    primary: hex(rColors.primary, FALLBACK_COLORS.primary),
    primaryDeep: hex(rColors.primaryDeep, FALLBACK_COLORS.primaryDeep),
    accent: hex(rColors.accent, FALLBACK_COLORS.accent),
    tint: hex(rColors.tint, FALLBACK_COLORS.tint),
    paper: hex(rColors.paper, FALLBACK_COLORS.paper),
    ink: hex(rColors.ink, FALLBACK_COLORS.ink),
    inkSoft: hex(rColors.inkSoft, FALLBACK_COLORS.inkSoft),
    line: hex(rColors.line, FALLBACK_COLORS.line),
  };

  const washes: ThemeWashes = {
    pink: hex(rWashes.pink, FALLBACK_WASHES.pink),
    blue: hex(rWashes.blue, FALLBACK_WASHES.blue),
    yellow: hex(rWashes.yellow, FALLBACK_WASHES.yellow),
    peach: hex(rWashes.peach, FALLBACK_WASHES.peach),
    mint: hex(rWashes.mint, FALLBACK_WASHES.mint),
  };

  const googleHref = (() => {
    const h = str(rFonts.googleHref);
    return h.startsWith("https://fonts.googleapis.com/css2?") ? h : FALLBACK_GOOGLE_HREF;
  })();

  // --- sections ---
  const heroRaw = isRecord(rSections.hero) ? rSections.hero : {};
  const greetingRaw = isRecord(rSections.greeting) ? rSections.greeting : {};
  const medicalRaw = isRecord(rSections.medical) ? rSections.medical : {};
  const philosophyRaw = isRecord(rSections.philosophy) ? rSections.philosophy : {};
  const galleryRaw = isRecord(rSections.gallery) ? rSections.gallery : {};
  const scheduleRaw = isRecord(rSections.schedule) ? rSections.schedule : {};
  const feesRaw = isRecord(rSections.fees) ? rSections.fees : {};
  const flowRaw = isRecord(rSections.flow) ? rSections.flow : {};
  const faqRaw = isRecord(rSections.faq) ? rSections.faq : {};
  const newsRaw = isRecord(rSections.news) ? rSections.news : {};
  const accessRaw = isRecord(rSections.access) ? rSections.access : {};
  const contactRaw = isRecord(rSections.contact) ? rSections.contact : {};
  const footerRaw = isRecord(rSections.footer) ? rSections.footer : {};

  let headline = strArray(heroRaw.headline);
  if (!headline.length) headline = [`${brandName}へ`, "*お気軽に*ご相談ください"];
  headline = headline.slice(0, 3);

  const medicalItems = objArray<SiteTemplate["sections"]["medical"]["items"][number]>(
    medicalRaw.items,
    (x) => {
      const ja = str(x.ja);
      if (!ja) return null;
      const icon = str(x.icon, "general");
      return {
        icon: MEDICAL_ICONS.has(icon) ? icon : "general",
        ja,
        en: str(x.en, "Medical"),
        lead: str(x.lead),
      };
    }
  );

  const galleryItems = objArray<SiteTemplate["sections"]["gallery"]["items"][number]>(
    galleryRaw.items,
    (x) => {
      const caption = str(x.caption);
      if (!caption) return null;
      return { image: imageSlot(x.image, caption), caption };
    }
  );

  const scheduleRows = objArray<SiteTemplate["sections"]["schedule"]["rows"][number]>(
    scheduleRaw.rows,
    (x) => {
      const label = str(x.label);
      if (!label) return null;
      const marks = Array.isArray(x.marks)
        ? x.marks.map((m) => (typeof m === "string" && m.trim() ? m.trim() : null))
        : [];
      return { label, marks };
    }
  );

  const feeGroups = objArray<SiteTemplate["sections"]["fees"]["groups"][number]>(
    feesRaw.groups,
    (x) => {
      const group = str(x.group);
      const items = objArray<{ name: string; price: string; note?: string }>(x.items, (it) => {
        const name = str(it.name);
        const price = str(it.price);
        if (!name || !price) return null;
        const note = str(it.note);
        return note ? { name, price, note } : { name, price };
      });
      if (!group || !items.length) return null;
      return { group, items };
    }
  );

  const flowSteps = objArray<SiteTemplate["sections"]["flow"]["steps"][number]>(
    flowRaw.steps,
    (x) => {
      const title = str(x.title);
      if (!title) return null;
      return { no: str(x.no), title, body: str(x.body) };
    }
  ).map((s, i) => ({ ...s, no: s.no || String(i + 1).padStart(2, "0") }));

  const faqItems = objArray<SiteTemplate["sections"]["faq"]["items"][number]>(faqRaw.items, (x) => {
    const q = str(x.q);
    const a = str(x.a);
    return q && a ? { q, a } : null;
  });

  const newsItems = objArray<SiteTemplate["sections"]["news"]["items"][number]>(newsRaw.items, (x) => {
    const title = str(x.title);
    return title ? { date: str(x.date), title } : null;
  });

  const accessInfo = objArray<SiteTemplate["sections"]["access"]["info"][number]>(
    accessRaw.info,
    (x) => {
      const term = str(x.term);
      const lines = strArray(x.lines);
      return term && lines.length ? { term, lines } : null;
    }
  );

  // --- layout / nav (kept consistent with the sections that actually have content) ---
  const contentBySection: Record<string, boolean> = {
    hero: true,
    greeting: str(greetingRaw.doctorName) !== "" || strArray(greetingRaw.message).length > 0,
    medical: medicalItems.length > 0,
    philosophy: strArray(philosophyRaw.body).length > 0 || str(philosophyRaw.lead) !== "",
    gallery: galleryItems.length > 0,
    schedule: scheduleRows.length > 0,
    fees: feeGroups.length > 0,
    flow: flowSteps.length > 0,
    faq: faqItems.length > 0,
    news: newsItems.length > 0,
    access: true,
    contact: true,
  };

  const rawLayout = Array.isArray(r.layout) ? r.layout : [];
  let layout = rawLayout
    .map((x) => (isRecord(x) ? { id: str(x.id), kind: str(x.kind, str(x.id)) } : null))
    .filter((x): x is { id: string; kind: string } => !!x && (KNOWN_SECTION_IDS as readonly string[]).includes(x.id))
    .filter((x) => contentBySection[x.id]);
  // de-dupe, preserve order
  const seen = new Set<string>();
  layout = layout.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  if (!layout.length) {
    layout = KNOWN_SECTION_IDS.filter((id) => contentBySection[id]).map((id) => ({ id, kind: id }));
  }

  const navLabels: Record<string, string> = {
    hero: "ホーム",
    greeting: "当院について",
    medical: "診療案内",
    philosophy: "当院の想い",
    gallery: "院内のようす",
    schedule: "診療時間",
    fees: "料金",
    flow: "受診の流れ",
    faq: "よくあるご質問",
    news: "お知らせ",
    access: "アクセス",
    contact: "お問い合わせ",
  };
  const defaultNav: NavItem[] = layout
    .filter((l) => l.id !== "contact")
    .map((l) => ({ href: `#${l.id}`, label: navLabels[l.id] ?? l.id }));
  const nav = navItems(r.nav, defaultNav).filter((n) =>
    layout.some((l) => `#${l.id}` === n.href)
  );

  const footerNav = navItems(footerRaw.nav, [
    ...layout.filter((l) => l.id !== "hero").map((l) => ({ href: `#${l.id}`, label: navLabels[l.id] ?? l.id })),
  ]).filter((n) => layout.some((l) => `#${l.id}` === n.href));

  return {
    meta: {
      title: str(rMeta.title, brandName),
      description: str(rMeta.description, `${brandName}の公式ホームページです。`),
    },
    theme: {
      colors,
      washes,
      botanicalStroke: hex(rTheme.botanicalStroke, "#c9bda4"),
      fonts: {
        googleHref,
        heading: str(rFonts.heading, FALLBACK_HEAD_FONT),
        body: str(rFonts.body, FALLBACK_BODY_FONT),
        headingTracking: str(rFonts.headingTracking, "0.09em"),
      },
    },
    brand: {
      name: brandName,
      nameEn: str(rBrand.nameEn, ""),
      logo: null,
    },
    contact: {
      phone: str(rContact.phone, "00-0000-0000"),
      phoneCaption: str(rContact.phoneCaption, "お電話でのお問い合わせ"),
      reserveUrl: str(rContact.reserveUrl, "https://lin.ee/0000000"),
      reserveLabel: str(rContact.reserveLabel, "LINEで予約"),
      address: str(rContact.address, "〒000-0000　○○県○○市○○町 0-0-0"),
    },
    layout,
    nav,
    sections: {
      hero: {
        image: imageSlot(heroRaw.image, ""),
        tagline: str(heroRaw.tagline, "地域のみなさまのための、かかりつけクリニック"),
        headline,
        sub: str(heroRaw.sub, `${brandName}の公式ホームページです。`),
        bubbles: strArray(heroRaw.bubbles).slice(0, 6),
      },
      greeting: {
        heading: heading(greetingRaw.heading, "当院について", "About"),
        image: imageSlot(greetingRaw.image, `${str(greetingRaw.doctorName)} ${brandName}`),
        doctorName: str(greetingRaw.doctorName),
        doctorRole: str(greetingRaw.doctorRole, "院長"),
        message: strArray(greetingRaw.message),
      },
      medical: {
        heading: heading(medicalRaw.heading, "診療案内", "Medical"),
        intro: str(medicalRaw.intro),
        items: medicalItems,
        conditions: strArray(medicalRaw.conditions).slice(0, 24),
      },
      philosophy: {
        heading: heading(philosophyRaw.heading, "当院の想い", "Our thoughts"),
        lead: str(philosophyRaw.lead),
        body: strArray(philosophyRaw.body),
      },
      gallery: {
        heading: heading(galleryRaw.heading, "院内のようす", "Our clinic"),
        intro: str(galleryRaw.intro),
        items: galleryItems,
      },
      schedule: {
        heading: heading(scheduleRaw.heading, "診療時間", "Hours"),
        cornerLabel: str(scheduleRaw.cornerLabel, "受付時間"),
        days: strArray(scheduleRaw.days, ["月", "火", "水", "木", "金", "土", "日"]),
        rows: scheduleRows,
        notes: strArray(scheduleRaw.notes),
      },
      fees: {
        heading: heading(feesRaw.heading, "料金の目安", "Fees"),
        disclaimer: str(
          feesRaw.disclaimer,
          "表示は目安です。保険が使える症状は保険診療です。価格は改定することがあります。"
        ),
        groups: feeGroups,
      },
      flow: {
        heading: heading(flowRaw.heading, "受診の流れ", "Flow"),
        steps: flowSteps,
      },
      faq: {
        heading: heading(faqRaw.heading, "よくあるご質問", "FAQ"),
        items: faqItems,
      },
      news: {
        heading: heading(newsRaw.heading, "お知らせ", "News"),
        items: newsItems,
      },
      access: {
        heading: heading(accessRaw.heading, "交通案内", "Access"),
        image: imageSlot(accessRaw.image, "周辺地図"),
        points: strArray(accessRaw.points),
        info: accessInfo,
      },
      contact: {
        heading: heading(contactRaw.heading, "ご予約・お問い合わせ", "Contact"),
        lead: str(
          contactRaw.lead,
          "はじめての方も、通院中の方も、どうぞお気軽にお問い合わせください。"
        ),
        reserveLabel: str(contactRaw.reserveLabel, "LINEで予約する"),
        phoneCaption: str(contactRaw.phoneCaption, "お電話"),
        note: str(contactRaw.note),
      },
      footer: {
        nav: footerNav,
        copyright: str(footerRaw.copyright, `© ${brandName}`),
      },
    },
  };
}
