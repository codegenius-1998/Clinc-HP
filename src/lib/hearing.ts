import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";

export type HearingSheet = {
  slug: string;
  templateId: string;
  templateLabel: string;
  colorScheme: string;
  colorSchemeLabel: string;
  clinicName: string;
  directorName: string;
  address: string;
  phone: string;
  line: string;
  hours: string;
  features: string;
  request: string;
  createdAt: string;
  previewUrl?: string;
  generationError?: string;
  cloudflareUrl?: string;
  cloudflareError?: string;
  /** slot id -> file name (under data/hearings/uploads/<slug>/) of a user-uploaded image for that slot. */
  uploadedImages?: Record<string, string>;
};

const DATA_DIR = path.join(process.cwd(), "data", "hearings");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

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

/** Persists an uploaded image for a given hearing/slot and returns the stored file name. */
export async function saveUploadedImage(slug: string, slotId: string, file: File): Promise<string> {
  const dir = path.join(UPLOADS_DIR, slug);
  await mkdir(dir, { recursive: true });
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${slotId}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);
  return fileName;
}

export function resolveUploadedImagePath(slug: string, fileName: string): string {
  return path.join(UPLOADS_DIR, slug, fileName);
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
