/** Coerces the raw JSON object OpenAI returns (or an edited template coming back from the site
 * editor) into a complete, renderable `SiteTemplate`.
 *
 * Beyond shape-checking every field, this applies three guardrails the model can't be trusted on:
 *   - contrast: a palette too pale to read is deepened until headings / buttons clear WCAG;
 *   - fonts: a Latin-only family (Roboto, …) is swapped for a Japanese one and `googleHref` rebuilt;
 *   - sections: a baseline set (greeting, medical, philosophy, schedule, flow, faq, access, contact)
 *     always appears, with synthesized copy when the model left it empty. */

import type {
  SiteTemplate,
  ImageSlot,
  Heading,
  NavItem,
  ThemeColors,
  ThemeWashes,
  CustomBlock,
} from "./types";
import { KNOWN_SECTION_IDS, CUSTOM_BLOCK_KINDS } from "./types";
import { resolveFontTheme } from "./fonts";
import { ensureReadable, parseHex, relativeLuminance } from "./color";

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

const MEDICAL_ICONS = new Set([
  "skin", "child", "sparkle", "care", "tooth", "eye", "bone", "heart", "allergy", "general",
]);

/** Canonical section order. Sections in BASELINE always render (with defaults); the rest appear
 * only when they carry content or the caller's layout explicitly keeps them. */
const SECTION_ORDER = [
  "hero", "greeting", "medical", "philosophy", "gallery",
  "schedule", "fees", "flow", "faq", "news", "access", "contact",
] as const;
const BASELINE = new Set(["hero", "greeting", "medical", "philosophy", "schedule", "flow", "faq", "access", "contact"]);

const NAV_LABELS: Record<string, string> = {
  hero: "ホーム", greeting: "当院について", medical: "診療案内", philosophy: "当院の想い",
  gallery: "院内のようす", schedule: "診療時間", fees: "料金", flow: "受診の流れ",
  faq: "よくあるご質問", news: "お知らせ", access: "アクセス", contact: "お問い合わせ",
};

export type NormalizeContext = {
  brandName: string;
  department?: string;
  hours?: string;
  /** true when re-normalising an edited template: the caller's `layout` is authoritative
   * (respect section removals / reordering) instead of being unioned with the baseline. */
  trustLayout?: boolean;
};

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

// --- colour hardening ------------------------------------------------------

function hardenColors(rColors: Record<string, unknown>): ThemeColors {
  let paper = hex(rColors.paper, FALLBACK_COLORS.paper);
  const paperRgb = parseHex(paper);
  // Our CSS assumes a light page — reject a dark "paper".
  if (!paperRgb || relativeLuminance(paperRgb) < 0.6) paper = FALLBACK_COLORS.paper;

  let tint = hex(rColors.tint, FALLBACK_COLORS.tint);
  const tintRgb = parseHex(tint);
  if (!tintRgb || relativeLuminance(tintRgb) < 0.7) tint = FALLBACK_COLORS.tint;

  return {
    paper,
    tint,
    // body text: needs to be genuinely dark on paper
    ink: ensureReadable(hex(rColors.ink, FALLBACK_COLORS.ink), paper, 7, "#3a3733"),
    // muted text (leads, captions)
    inkSoft: ensureReadable(hex(rColors.inkSoft, FALLBACK_COLORS.inkSoft), paper, 3.6, "#6a655e"),
    // headings, links, small EN labels
    primaryDeep: ensureReadable(hex(rColors.primaryDeep, FALLBACK_COLORS.primaryDeep), paper, 4.5, FALLBACK_COLORS.primaryDeep),
    // used as a solid fill under white text (FAQ "Q" badge, brand mark)
    primary: ensureReadable(hex(rColors.primary, FALLBACK_COLORS.primary), "#ffffff", 2.6, FALLBACK_COLORS.primary),
    // the reserve button: solid fill under white text
    accent: ensureReadable(hex(rColors.accent, FALLBACK_COLORS.accent), "#ffffff", 3, "#c8688c"),
    line: hex(rColors.line, FALLBACK_COLORS.line),
  };
}

// --- section content defaults --------------------------------------------

function greetingDefault(brand: string, dept?: string): string[] {
  return [
    `${brand}は、${dept ? `${dept}を中心に、` : ""}地域のみなさまのかかりつけ医院です。気になる症状やご不安があれば、どうぞお気軽にご相談ください。`,
    "一人ひとりの状態や生活に合わせて、わかりやすい説明と、無理のない治療を心がけています。",
  ];
}

const PHILOSOPHY_DEFAULT = {
  lead: "安心して相談できる場所であること。",
  body: [
    "症状の重さも、通える時間も、人によってちがいます。その方に合ったやり方で、いまできることから少しずつ整えていきます。",
    "検査や治療の内容は、納得していただけるようにご説明します。気になることは遠慮なくお尋ねください。",
  ],
};

const FLOW_DEFAULT = [
  { no: "01", title: "ご予約・ご来院", body: "お電話またはWEBでご予約いただけます。当日の受付も可能です。初診の方は保険証をお持ちください。" },
  { no: "02", title: "受付・問診", body: "受付で保険証をお出しください。症状や経過について問診票にご記入いただきます。" },
  { no: "03", title: "診察・検査", body: "症状をうかがい、必要に応じて検査を行います。考えられる原因と治療の選択肢をご説明します。" },
  { no: "04", title: "お会計・次回のご案内", body: "処方や次回の受診についてご案内します。ご不明な点は受付でお尋ねください。" },
];

const FAQ_DEFAULT = [
  { q: "予約は必要ですか？", a: "ご予約をおすすめしていますが、当日の受付も可能です。混雑時は順番でのご案内となります。" },
  { q: "初診で必要なものはありますか？", a: "健康保険証をお持ちください。他の医療機関のお薬があれば、お薬手帳もご持参ください。" },
  { q: "駐車場はありますか？", a: "詳しくはアクセスをご確認ください。近隣のコインパーキングもご利用いただけます。" },
];

// --- custom blocks -----------------------------------------------------

function normalizeCustomBlocks(v: unknown): CustomBlock[] {
  if (!Array.isArray(v)) return [];
  const out: CustomBlock[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!isRecord(raw)) continue;
    const kind = str(raw.kind);
    if (!(CUSTOM_BLOCK_KINDS as readonly string[]).includes(kind)) continue;
    let id = str(raw.id);
    if (!/^[a-z]+-\d+$/.test(id) || seen.has(id)) id = `${kind}-${out.length + 1}`;
    while (seen.has(id)) id = `${kind}-${out.length + 1 + Math.floor(Math.random() * 1000)}`;
    seen.add(id);
    const h = heading(raw.heading, "", "Section");

    if (kind === "text") {
      const body = strArray(raw.body);
      out.push({
        id,
        kind: "text",
        heading: h,
        align: raw.align === "center" ? "center" : "left",
        body: body.length ? body : ["ここに本文を入力します。"],
      });
    } else if (kind === "image") {
      const images = Array.isArray(raw.images)
        ? raw.images.map((im) => imageSlot(im, "")).slice(0, 12)
        : [];
      out.push({
        id,
        kind: "image",
        heading: h,
        caption: str(raw.caption),
        images: images.length ? images : [{ src: null, alt: "" }],
      });
    } else {
      const cols = raw.columns === 2 || raw.columns === 4 ? raw.columns : 3;
      const items = objArray<{ title: string; body: string; image: ImageSlot }>(raw.items, (it) => {
        const title = str(it.title);
        const body = str(it.body);
        if (!title && !body) return null;
        return { title, body, image: imageSlot(it.image, "") };
      });
      out.push({
        id,
        kind: "grid",
        heading: h,
        columns: cols,
        items: items.length ? items : [{ title: "項目", body: "説明文", image: { src: null, alt: "" } }],
      });
    }
  }
  return out;
}

// --- main ----------------------------------------------------------------

export function normalizeTemplate(raw: unknown, ctx: NormalizeContext | string): SiteTemplate {
  const brandName = typeof ctx === "string" ? ctx : ctx.brandName;
  const department = typeof ctx === "string" ? undefined : ctx.department;
  const hoursText = typeof ctx === "string" ? undefined : ctx.hours;
  const trustLayout = typeof ctx === "string" ? false : Boolean(ctx.trustLayout);

  const r = isRecord(raw) ? raw : {};
  const rMeta = isRecord(r.meta) ? r.meta : {};
  const rTheme = isRecord(r.theme) ? r.theme : {};
  const rColors = isRecord(rTheme.colors) ? rTheme.colors : {};
  const rWashes = isRecord(rTheme.washes) ? rTheme.washes : {};
  const rFonts = isRecord(rTheme.fonts) ? rTheme.fonts : {};
  const rBrand = isRecord(r.brand) ? r.brand : {};
  const rContact = isRecord(r.contact) ? r.contact : {};
  const rSections = isRecord(r.sections) ? r.sections : {};

  const brand = str(rBrand.name, brandName);
  const colors = hardenColors(rColors);
  const washes: ThemeWashes = {
    pink: hex(rWashes.pink, FALLBACK_WASHES.pink),
    blue: hex(rWashes.blue, FALLBACK_WASHES.blue),
    yellow: hex(rWashes.yellow, FALLBACK_WASHES.yellow),
    peach: hex(rWashes.peach, FALLBACK_WASHES.peach),
    mint: hex(rWashes.mint, FALLBACK_WASHES.mint),
  };
  const fonts = resolveFontTheme(
    str(rFonts.heading),
    str(rFonts.body),
    str(rFonts.headingTracking, "0.08em")
  );
  const fontScale =
    typeof rTheme.fontScale === "number" && rTheme.fontScale >= 0.8 && rTheme.fontScale <= 1.3
      ? Number(rTheme.fontScale.toFixed(3))
      : 1;

  // --- raw section objects ---
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
  if (!headline.length) headline = [`${brand}へ`, "*お気軽に*ご相談ください"];
  headline = headline.slice(0, 3);

  let medicalItems = objArray<SiteTemplate["sections"]["medical"]["items"][number]>(medicalRaw.items, (x) => {
    const ja = str(x.ja);
    if (!ja) return null;
    const icon = str(x.icon, "general");
    return {
      icon: MEDICAL_ICONS.has(icon) ? icon : "general",
      ja,
      en: str(x.en, "Medical"),
      lead: str(x.lead),
      image: imageSlot(x.image, ja),
    };
  });
  if (!medicalItems.length) {
    medicalItems = [{
      icon: "general",
      ja: department || "一般診療",
      en: "General",
      lead: "気になる症状のご相談に対応します。まずはお気軽にお越しください。",
      image: { src: null, alt: "" },
    }];
  }

  const galleryItems = objArray<SiteTemplate["sections"]["gallery"]["items"][number]>(galleryRaw.items, (x) => {
    const caption = str(x.caption);
    if (!caption) return null;
    return { image: imageSlot(x.image, caption), caption };
  });

  let scheduleRows = objArray<SiteTemplate["sections"]["schedule"]["rows"][number]>(scheduleRaw.rows, (x) => {
    const label = str(x.label);
    if (!label) return null;
    const marks = Array.isArray(x.marks)
      ? x.marks.map((m) => (typeof m === "string" && m.trim() ? m.trim() : null))
      : [];
    return { label, marks };
  });
  const scheduleNotes = strArray(scheduleRaw.notes);
  if (!scheduleRows.length) {
    scheduleRows = [{ label: "受付時間", marks: ["●", "●", "●", "●", "●", "▲", "／"] }];
    if (hoursText && !scheduleNotes.length) scheduleNotes.push(hoursText);
  }

  const feeGroups = objArray<SiteTemplate["sections"]["fees"]["groups"][number]>(feesRaw.groups, (x) => {
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
  });

  let flowSteps = objArray<SiteTemplate["sections"]["flow"]["steps"][number]>(flowRaw.steps, (x) => {
    const title = str(x.title);
    if (!title) return null;
    return { no: str(x.no), title, body: str(x.body) };
  }).map((s, i) => ({ ...s, no: s.no || String(i + 1).padStart(2, "0") }));
  if (flowSteps.length < 2) flowSteps = FLOW_DEFAULT;

  let faqItems = objArray<SiteTemplate["sections"]["faq"]["items"][number]>(faqRaw.items, (x) => {
    const q = str(x.q);
    const a = str(x.a);
    return q && a ? { q, a } : null;
  });
  if (!faqItems.length) faqItems = FAQ_DEFAULT;

  const newsItems = objArray<SiteTemplate["sections"]["news"]["items"][number]>(newsRaw.items, (x) => {
    const title = str(x.title);
    return title ? { date: str(x.date), title } : null;
  });

  const accessInfo = objArray<SiteTemplate["sections"]["access"]["info"][number]>(accessRaw.info, (x) => {
    const term = str(x.term);
    const lines = strArray(x.lines);
    return term && lines.length ? { term, lines } : null;
  });

  let greetingMessage = strArray(greetingRaw.message);
  if (!greetingMessage.length) greetingMessage = greetingDefault(brand, department);

  let philosophyLead = str(philosophyRaw.lead);
  let philosophyBody = strArray(philosophyRaw.body);
  if (!philosophyBody.length && !philosophyLead) {
    philosophyLead = PHILOSOPHY_DEFAULT.lead;
    philosophyBody = PHILOSOPHY_DEFAULT.body;
  }

  // --- custom (editor-inserted) blocks ---
  const customBlocks = normalizeCustomBlocks(r.customBlocks);
  const customIds = new Set(customBlocks.map((b) => b.id));
  const customLabel = (id: string) =>
    customBlocks.find((b) => b.id === id)?.heading.ja || "セクション";

  // --- layout ---
  const hasOptionalContent: Record<string, boolean> = {
    gallery: galleryItems.length > 0,
    fees: feeGroups.length > 0,
    news: newsItems.length > 0,
  };

  const rawLayout = (Array.isArray(r.layout) ? r.layout : [])
    .map((x) => (isRecord(x) ? { id: str(x.id), kind: str(x.kind, str(x.id)) } : null))
    .filter(
      (x): x is { id: string; kind: string } =>
        !!x && ((KNOWN_SECTION_IDS as readonly string[]).includes(x.id) || customIds.has(x.id))
    );
  const rawIds = new Set(rawLayout.map((x) => x.id));

  let layout: { id: string; kind: string }[];
  if (trustLayout && rawLayout.length) {
    const seen = new Set<string>();
    layout = rawLayout.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  } else {
    layout = SECTION_ORDER.filter(
      (id) => BASELINE.has(id) || rawIds.has(id) || hasOptionalContent[id]
    ).map((id) => ({ id, kind: id }));
    // custom blocks only enter via an explicit layout — append any the caller listed
    for (const item of rawLayout) if (customIds.has(item.id)) layout.push(item);
  }
  const inLayout = (id: string) => layout.some((l) => l.id === id);
  const label = (id: string) => NAV_LABELS[id] ?? customLabel(id);
  // custom blocks only get a nav link once they have a heading to name it
  const navigable = (id: string) =>
    !customIds.has(id) || Boolean(customBlocks.find((b) => b.id === id)?.heading.ja);

  // Nav and footer nav are always derived from the final layout — the model's / editor's own nav
  // arrays are ignored so they can never drift out of sync with the sections that exist.
  const finalNav: NavItem[] = layout
    .filter((l) => l.id !== "contact" && navigable(l.id))
    .map((l) => ({ href: `#${l.id}`, label: label(l.id) }));
  const finalFooterNav: NavItem[] = layout
    .filter((l) => l.id !== "hero" && navigable(l.id))
    .map((l) => ({ href: `#${l.id}`, label: label(l.id) }));

  // drop orphan blocks (present in customBlocks but not in layout — e.g. removed then re-added)
  const usedCustomBlocks = customBlocks.filter((b) => inLayout(b.id));

  return {
    meta: {
      title: str(rMeta.title, brand),
      description: str(rMeta.description, `${brand}の公式ホームページです。`),
    },
    theme: {
      colors,
      washes,
      botanicalStroke: hex(rTheme.botanicalStroke, "#c9bda4"),
      fonts,
      fontScale,
    },
    brand: { name: brand, nameEn: str(rBrand.nameEn, ""), logo: null },
    contact: {
      phone: str(rContact.phone, "00-0000-0000"),
      phoneCaption: str(rContact.phoneCaption, "お電話でのお問い合わせ"),
      reserveUrl: str(rContact.reserveUrl, "https://lin.ee/0000000"),
      reserveLabel: str(rContact.reserveLabel, "LINEで予約"),
      address: str(rContact.address, "〒000-0000　○○県○○市○○町 0-0-0"),
    },
    layout,
    nav: finalNav,
    customBlocks: usedCustomBlocks,
    sections: {
      hero: {
        image: imageSlot(heroRaw.image, ""),
        tagline: str(heroRaw.tagline, "地域のみなさまのための、かかりつけクリニック"),
        headline,
        sub: str(heroRaw.sub, `${brand}の公式ホームページです。`),
        bubbles: strArray(heroRaw.bubbles).slice(0, 6),
      },
      greeting: {
        heading: heading(greetingRaw.heading, "当院について", "About"),
        image: imageSlot(greetingRaw.image, `${str(greetingRaw.doctorName)} ${brand}`.trim()),
        doctorName: str(greetingRaw.doctorName),
        doctorRole: str(greetingRaw.doctorRole, "院長"),
        message: greetingMessage,
      },
      medical: {
        heading: heading(medicalRaw.heading, "診療案内", "Medical"),
        intro: str(medicalRaw.intro),
        items: medicalItems,
        conditions: strArray(medicalRaw.conditions).slice(0, 24),
      },
      philosophy: {
        heading: heading(philosophyRaw.heading, "当院の想い", "Our thoughts"),
        lead: philosophyLead,
        body: philosophyBody,
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
        notes: scheduleNotes,
      },
      fees: {
        heading: heading(feesRaw.heading, "料金の目安", "Fees"),
        disclaimer: str(
          feesRaw.disclaimer,
          "表示は目安です。保険が使える症状は保険診療です。価格は改定することがあります。"
        ),
        groups: feeGroups,
      },
      flow: { heading: heading(flowRaw.heading, "受診の流れ", "Flow"), steps: flowSteps },
      faq: { heading: heading(faqRaw.heading, "よくあるご質問", "FAQ"), items: faqItems },
      news: { heading: heading(newsRaw.heading, "お知らせ", "News"), items: newsItems },
      access: {
        heading: heading(accessRaw.heading, "交通案内", "Access"),
        image: imageSlot(accessRaw.image, "周辺地図"),
        exteriorPhoto: imageSlot(accessRaw.exteriorPhoto, "外観"),
        points: strArray(accessRaw.points),
        info: accessInfo,
      },
      contact: {
        heading: heading(contactRaw.heading, "ご予約・お問い合わせ", "Contact"),
        lead: str(contactRaw.lead, "はじめての方も、通院中の方も、どうぞお気軽にお問い合わせください。"),
        reserveLabel: str(contactRaw.reserveLabel, "LINEで予約する"),
        phoneCaption: str(contactRaw.phoneCaption, "お電話"),
        note: str(contactRaw.note),
      },
      footer: { nav: finalFooterNav, copyright: str(footerRaw.copyright, `© ${brand}`) },
    },
  };
}
