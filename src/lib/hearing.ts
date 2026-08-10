import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import type { ImageCategoryKey } from "./imageCategories";

export type HearingSheet = {
  slug: string;
  /** Chosen design preset id (see src/lib/designPresets.ts) — a style/mood brief, not an HTML
   * skeleton. The actual page content and structure are generated fresh by OpenAI (see
   * src/lib/siteGenerator.ts) for every clinic. */
  templateId: string;
  templateLabel: string;
  /** Color theme id from the site-wide palette (see src/lib/designPresets.ts's listColorPalette) —
   * chosen independently of templateId/preset. */
  colorScheme: string;
  colorSchemeLabel: string;
  clinicName: string;
  directorName: string;
  address: string;
  phone: string;
  line: string;
  department: string;
  hours: string;
  features: string;
  request: string;
  /** Real staff members to render as #staff cards — count drives how many card blocks are rendered. */
  staffMembers?: { name: string; comment: string; role?: string; photoUrl?: string }[];
  /** Real FAQ entries — if provided, used verbatim instead of the AI inventing general Q&A. */
  faqs?: { question: string; answer: string }[];
  /** Real announcements to render in #news — if empty, the AI invents a plausible general count/content. */
  news?: { date: string; title: string }[];
  /** Real price-list rows for #pricing — never AI-invented; the section is hidden entirely when empty. */
  priceItems?: { name: string; price: string; note?: string }[];
  /** Explicit per-section show/hide + display order chosen on the hearing screen — when present, this
   * wins over the AI's own sectionVisibility judgement call (see planGeneration). */
  sectionPrefs?: { id: string; visible: boolean; order: number }[];
  createdAt: string;
  previewUrl?: string;
  generationError?: string;
  cloudflareUrl?: string;
  cloudflareError?: string;
  /** category -> public Supabase Storage URLs of user-uploaded photos. */
  uploadedImages?: Partial<Record<ImageCategoryKey, string[]>>;
};

const DATA_DIR = path.join(process.cwd(), "data", "hearings");

/** ASCII-only slug: URLs, file paths, and Cloudflare Pages project names all reject non-ASCII, so
 * Japanese clinic names (the common case) always fall back to the `clinic-<suffix>` form. */
export function generateSlug(clinicName: string): string {
  const base = clinicName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `clinic-${suffix}`;
}

export async function saveHearing(input: Omit<HearingSheet, "createdAt">): Promise<HearingSheet> {
  await mkdir(DATA_DIR, { recursive: true });
  const hearing: HearingSheet = {
    ...input,
    createdAt: new Date().toISOString(),
  };
  await writeFile(path.join(DATA_DIR, `${hearing.slug}.json`), JSON.stringify(hearing, null, 2), "utf-8");
  return hearing;
}

export async function listHearings(): Promise<HearingSheet[]> {
  await mkdir(DATA_DIR, { recursive: true });
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  const hearings = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
      return JSON.parse(raw) as HearingSheet;
    })
  );
  return hearings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getHearing(slug: string): Promise<HearingSheet | null> {
  try {
    const raw = await readFile(path.join(DATA_DIR, `${slug}.json`), "utf-8");
    return JSON.parse(raw) as HearingSheet;
  } catch {
    return null;
  }
}

export async function updateHearing(
  slug: string,
  patch: Partial<Pick<HearingSheet, "previewUrl" | "generationError" | "cloudflareUrl" | "cloudflareError">>
): Promise<HearingSheet | null> {
  const hearing = await getHearing(slug);
  if (!hearing) {
    return null;
  }
  const updated: HearingSheet = { ...hearing, ...patch };
  await writeFile(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
