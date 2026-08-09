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
};

const DATA_DIR = path.join(process.cwd(), "data", "hearings");

function toSlug(clinicName: string): string {
  const base = clinicName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-龯]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Date.now().toString(36);
  return base ? `${base}-${suffix}` : `clinic-${suffix}`;
}

export async function saveHearing(input: Omit<HearingSheet, "slug" | "createdAt">): Promise<HearingSheet> {
  await mkdir(DATA_DIR, { recursive: true });
  const hearing: HearingSheet = {
    ...input,
    slug: toSlug(input.clinicName),
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
