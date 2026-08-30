import { d1Query } from "./d1";
import type { ImageCategoryKey } from "./imageCategories";

/** A site-build application (ヒアリングシート) as submitted from /mypage/apply.
 *
 * Everything here is filled in by the applicant at submission time and never changed afterwards — an
 * admin only views and deletes these. The columns are `slug`, `owner_email`, `clinic_name`,
 * `created_at`; everything else is one JSON blob (`data`). */
export type HearingSheet = {
  slug: string;
  /** Email of the clinic_owner who submitted this via /mypage/apply. */
  ownerEmail?: string;
  clinicName: string;
  address: string;
  phone: string;
  line: string;
  department: string;
  /** Snapshot of the service names selected on /mypage/apply's "診療科・サービス" step (see
   * src/lib/content.ts). `department` above is derived from these at submit time. */
  serviceNames?: string[];
  hours: string;
  features: string;
  /** Snapshot of the feature names selected on /mypage/apply's "特徴" step. */
  featureNames?: string[];
  request: string;
  staffMembers?: { name: string; comment: string; role?: string; photoUrl?: string }[];
  faqs?: { question: string; answer: string }[];
  news?: { date: string; title: string }[];
  priceItems?: { name: string; price: string; note?: string }[];
  /** Target patient demographics picked from the admin-managed Targets list. */
  targetNames?: string[];
  createdAt: string;
  /** category -> public Supabase Storage URLs of user-uploaded photos. */
  uploadedImages?: Partial<Record<ImageCategoryKey, string[]>>;
  /** Set once an admin has generated a static site from this sheet (see
   * src/lib/buildSiteFromHearing.ts). The bundle lives at public/_generated/<slug>/ and is served
   * under /api/generated/<slug>/. Regenerating overwrites both the bundle and this field. */
  generatedSite?: { at: string; imagesGenerated?: number; imagesFromUploads?: number };
};

/** ASCII-only slug: Japanese clinic names (the common case) fall back to the `clinic-<suffix>` form. */
export function generateSlug(clinicName: string): string {
  const base = clinicName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `clinic-${suffix}`;
}

/** Persistence for application sheets. D1, one statement per call (see src/lib/d1.ts).
 *
 * `slug` / `owner_email` / `clinic_name` / `created_at` are their own columns; everything the
 * applicant filled in is one JSON blob. */

type HearingRow = {
  slug: string;
  owner_email: string | null;
  clinic_name: string;
  created_at: string;
  data: string;
};

/** The fields that have their own column. Everything else in HearingSheet goes into `data`. */
const COLUMN_FIELDS = ["slug", "ownerEmail", "clinicName", "createdAt"] as const;

const SELECT_COLUMNS = "slug, owner_email, clinic_name, created_at, data";

function toRow(hearing: HearingSheet): HearingRow {
  // Strip the column-backed fields out of the blob rather than storing them twice.
  const rest: Record<string, unknown> = { ...hearing };
  for (const field of COLUMN_FIELDS) delete rest[field];

  return {
    slug: hearing.slug,
    owner_email: hearing.ownerEmail ?? null,
    clinic_name: hearing.clinicName,
    created_at: hearing.createdAt,
    data: JSON.stringify(rest),
  };
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fromRow(row: HearingRow): HearingSheet {
  const rest = parseJson<Partial<HearingSheet>>(row.data, {});
  return {
    ...rest,
    slug: row.slug,
    ownerEmail: row.owner_email ?? undefined,
    clinicName: row.clinic_name,
    createdAt: row.created_at,
  } as HearingSheet;
}

/** Writes an application sheet. Upserts on slug so re-submitting the same record is harmless. */
export async function saveHearing(
  input: Omit<HearingSheet, "createdAt"> & { createdAt?: string }
): Promise<HearingSheet> {
  const hearing: HearingSheet = { ...input, createdAt: input.createdAt ?? new Date().toISOString() };
  const row = toRow(hearing);
  await d1Query(
    `INSERT INTO hearings (${SELECT_COLUMNS}) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       owner_email = excluded.owner_email,
       clinic_name = excluded.clinic_name,
       created_at = excluded.created_at,
       data = excluded.data`,
    [row.slug, row.owner_email, row.clinic_name, row.created_at, row.data]
  );
  return hearing;
}

export async function listHearings(): Promise<HearingSheet[]> {
  const result = await d1Query<HearingRow>(`SELECT ${SELECT_COLUMNS} FROM hearings ORDER BY created_at DESC`);
  return result.results.map(fromRow);
}

/** The current clinic_owner's own submissions only — powers /mypage's 申請一覧, which (unlike
 * /admin/requests) must never show another clinic's data. Filtered in SQL rather than in JavaScript:
 * reading every clinic's row in order to discard most of them is how a leak gets written by accident. */
export async function listHearingsByOwner(ownerEmail: string): Promise<HearingSheet[]> {
  const result = await d1Query<HearingRow>(
    `SELECT ${SELECT_COLUMNS} FROM hearings WHERE owner_email = ? ORDER BY created_at DESC`,
    [ownerEmail]
  );
  return result.results.map(fromRow);
}

export async function getHearing(slug: string): Promise<HearingSheet | null> {
  const result = await d1Query<HearingRow>(`SELECT ${SELECT_COLUMNS} FROM hearings WHERE slug = ?`, [slug]);
  const row = result.results[0];
  return row ? fromRow(row) : null;
}

/** Removes an application (admin request management, or an owner deleting their own). */
export async function deleteHearing(slug: string): Promise<void> {
  await d1Query("DELETE FROM hearings WHERE slug = ?", [slug]);
}
