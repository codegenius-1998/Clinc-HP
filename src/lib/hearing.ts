import { d1Query } from "./d1";
import type { ImageCategoryKey } from "./imageCategories";

export type HearingSheet = {
  slug: string;
  /** Email of the clinic_owner who submitted this via /mypage/apply. Absent on hearings created
   * through the older, unauthenticated /create flow, which has since been deleted. */
  ownerEmail?: string;
  /** The design template this site was built from — a record of what the AI auto-selector CHOSE
   * (see selectTemplate.ts), not something the clinic picks. Unset until generation has run, which
   * is what `hearingStatus` reads to tell an unapproved application from a built one. */
  templateId?: string;
  templateLabel?: string;
  /** Why the auto-selector picked that template. Shown to admins so a poor result can be traced to
   * the template's `mood` text rather than guessed at. */
  templateReason?: string;
  clinicName: string;
  address: string;
  phone: string;
  line: string;
  department: string;
  /** Snapshot of the service names selected on /mypage/apply's "診療科・サービス" step (see
   * src/lib/content.ts). `department` above is derived from these at submit time for
   * generateContentPlan, which only reads free text. */
  serviceNames?: string[];
  hours: string;
  features: string;
  /** Snapshot of the feature names selected on /mypage/apply's "特徴" step. `features` above is
   * derived from these at submit time for generateContentPlan. */
  featureNames?: string[];
  request: string;
  /** Real staff members to render as #staff cards — count drives how many card blocks are rendered. */
  staffMembers?: { name: string; comment: string; role?: string; photoUrl?: string }[];
  /** Real FAQ entries — if provided, used verbatim instead of the AI inventing general Q&A. */
  faqs?: { question: string; answer: string }[];
  /** Real announcements to render in #news — if empty, the AI invents a plausible general count/content. */
  news?: { date: string; title: string }[];
  /** Real price-list rows for #pricing — never AI-invented; the section is hidden entirely when empty. */
  priceItems?: { name: string; price: string; note?: string }[];
  /** Target patient demographics picked from the admin-managed Targets list (hp-templates content
   * model) — supplementary context for the AI, not tied to any single SITE_SPEC section. */
  targetNames?: string[];
  createdAt: string;
  previewUrl?: string;
  generationError?: string;
  /** ISO timestamp of when a build was kicked off. Set the moment 作成 is pressed and cleared when the
   * run ends (either outcome), so the screens can show 作成中 for a job that is still running.
   *
   * This exists because a build takes minutes — measured at ~4 for a full site with 20 images — while
   * the browser's request to start it must return in seconds. Cloudflare cuts an origin response off
   * at 100s, so waiting for the result inside the request meant the tunnel killed the connection every
   * single time and the operator saw a failure even though the server went on to finish successfully. */
  generationStartedAt?: string;
  /** Result of the automatic design check run at the end of the last build (see designCheck.ts).
   * Recorded rather than recomputed on every page view because the check reads the generated files
   * off disk, and the admin list would otherwise do that for every row. */
  designCheck?: { high: number; medium: number; low: number; checkedAt: string };
  cloudflareUrl?: string;
  cloudflareError?: string;
  /** category -> public Supabase Storage URLs of user-uploaded photos. */
  uploadedImages?: Partial<Record<ImageCategoryKey, string[]>>;
};

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

/** Persistence for hearing sheets. D1, one statement per call (see src/lib/d1.ts).
 *
 * The shape of the table mirrors the shape of this module's API rather than the shape of the type:
 * everything `updateHearing` is allowed to patch is its own column, and everything the applicant
 * filled in is one JSON blob. A field therefore lives in exactly one place — never both — which is
 * what lets an update be a single UPDATE rather than a read, a merge and a write. */

type HearingRow = {
  slug: string;
  owner_email: string | null;
  clinic_name: string;
  created_at: string;
  template_id: string | null;
  template_label: string | null;
  template_reason: string | null;
  preview_url: string | null;
  generation_error: string | null;
  generation_started_at: string | null;
  design_check: string | null;
  cloudflare_url: string | null;
  cloudflare_error: string | null;
  data: string;
};

/** The fields that have their own column. Everything else in HearingSheet goes into `data`. */
const COLUMN_FIELDS = [
  "slug",
  "ownerEmail",
  "clinicName",
  "createdAt",
  "templateId",
  "templateLabel",
  "templateReason",
  "previewUrl",
  "generationError",
  "generationStartedAt",
  "designCheck",
  "cloudflareUrl",
  "cloudflareError",
] as const;

/** Column name for each patchable field, so `updateHearing` can build its SET clause from the keys
 * the caller actually passed without ever interpolating one of them into SQL. */
const COLUMN_BY_FIELD: Record<string, string> = {
  ownerEmail: "owner_email",
  clinicName: "clinic_name",
  createdAt: "created_at",
  templateId: "template_id",
  templateLabel: "template_label",
  templateReason: "template_reason",
  previewUrl: "preview_url",
  generationError: "generation_error",
  generationStartedAt: "generation_started_at",
  designCheck: "design_check",
  cloudflareUrl: "cloudflare_url",
  cloudflareError: "cloudflare_error",
};

const SELECT_COLUMNS =
  "slug, owner_email, clinic_name, created_at, template_id, template_label, template_reason, " +
  "preview_url, generation_error, generation_started_at, design_check, cloudflare_url, cloudflare_error, data";

function toRow(hearing: HearingSheet): HearingRow {
  // Strip the column-backed fields out of the blob rather than storing them twice: two copies of
  // `previewUrl` is two answers to the same question the first time an update touches only one.
  const rest: Record<string, unknown> = { ...hearing };
  for (const field of COLUMN_FIELDS) delete rest[field];

  return {
    slug: hearing.slug,
    owner_email: hearing.ownerEmail ?? null,
    clinic_name: hearing.clinicName,
    created_at: hearing.createdAt,
    template_id: hearing.templateId ?? null,
    template_label: hearing.templateLabel ?? null,
    template_reason: hearing.templateReason ?? null,
    preview_url: hearing.previewUrl ?? null,
    generation_error: hearing.generationError ?? null,
    generation_started_at: hearing.generationStartedAt ?? null,
    design_check: hearing.designCheck ? JSON.stringify(hearing.designCheck) : null,
    cloudflare_url: hearing.cloudflareUrl ?? null,
    cloudflare_error: hearing.cloudflareError ?? null,
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
    templateId: row.template_id ?? undefined,
    templateLabel: row.template_label ?? undefined,
    templateReason: row.template_reason ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    generationError: row.generation_error ?? undefined,
    generationStartedAt: row.generation_started_at ?? undefined,
    designCheck: parseJson<HearingSheet["designCheck"]>(row.design_check, undefined),
    cloudflareUrl: row.cloudflare_url ?? undefined,
    cloudflareError: row.cloudflare_error ?? undefined,
  } as HearingSheet;
}

/** Writes a hearing sheet. Upserts on slug so re-importing the same record is harmless — the import
 * script (scripts/import-hearings.mts) relies on that to be re-runnable. */
export async function saveHearing(input: Omit<HearingSheet, "createdAt"> & { createdAt?: string }): Promise<HearingSheet> {
  const hearing: HearingSheet = { ...input, createdAt: input.createdAt ?? new Date().toISOString() };
  const row = toRow(hearing);
  await d1Query(
    `INSERT INTO hearings (${SELECT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       owner_email = excluded.owner_email,
       clinic_name = excluded.clinic_name,
       created_at = excluded.created_at,
       template_id = excluded.template_id,
       template_label = excluded.template_label,
       template_reason = excluded.template_reason,
       preview_url = excluded.preview_url,
       generation_error = excluded.generation_error,
       generation_started_at = excluded.generation_started_at,
       design_check = excluded.design_check,
       cloudflare_url = excluded.cloudflare_url,
       cloudflare_error = excluded.cloudflare_error,
       data = excluded.data`,
    [
      row.slug,
      row.owner_email,
      row.clinic_name,
      row.created_at,
      row.template_id,
      row.template_label,
      row.template_reason,
      row.preview_url,
      row.generation_error,
      row.generation_started_at,
      row.design_check,
      row.cloudflare_url,
      row.cloudflare_error,
      row.data,
    ]
  );
  return hearing;
}

export async function listHearings(): Promise<HearingSheet[]> {
  const result = await d1Query<HearingRow>(`SELECT ${SELECT_COLUMNS} FROM hearings ORDER BY created_at DESC`);
  return result.results.map(fromRow);
}

/** The current clinic_owner's own submissions only — powers /mypage's 申請一覧・サイト一覧, which
 * (unlike /admin/requests) must never show another clinic's data. Filtered in SQL rather than in
 * JavaScript: reading every clinic's row in order to discard most of them is how a leak gets written
 * by accident later. */
export async function listHearingsByOwner(ownerEmail: string): Promise<HearingSheet[]> {
  const result = await d1Query<HearingRow>(
    `SELECT ${SELECT_COLUMNS} FROM hearings WHERE owner_email = ? ORDER BY created_at DESC`,
    [ownerEmail]
  );
  return result.results.map(fromRow);
}

export type HearingStatus = { key: "pending_template" | "generating" | "processing" | "generated" | "failed"; label: string; className: string };

/** Shared by /admin/requests and /mypage/requests so both screens agree on what a hearing's status
 * means. "pending_template" only exists because /mypage/apply intentionally never sets templateId —
 * that choice is deferred to an admin via assignTemplateAction. */
/** Rewrites a stored `generationError` into something a clinic can act on.
 *
 * Applied at DISPLAY time, not only when the error is written: records saved before this existed hold
 * the raw text (a bare "fetch failed" reads like a bug in the site rather than something a retry
 * fixes), and re-running generation just to improve a message would cost real money in API calls. */
export function friendlyGenerationError(message: string): string {
  if (/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(message)) {
    return "生成中に通信が切れました（AI画像の生成に時間がかかるため、途中で接続が切れることがあります）。もう一度「作成」を押してください。";
  }
  return message;
}

export function hearingStatus(
  hearing: Pick<HearingSheet, "templateId" | "previewUrl" | "generationError" | "generationStartedAt">
): HearingStatus {
  // Checked before everything else: a re-run of an already-built site is still "作成中" while it runs,
  // and a first build has no templateId yet but must not read as 承認待ち once it has been started.
  if (hearing.generationStartedAt) return { key: "generating", label: "作成中", className: "bg-sky-50 text-sky-700" };
  if (!hearing.templateId) return { key: "pending_template", label: "承認待ち", className: "bg-amber-50 text-amber-700" };
  // previewUrl wins over generationError: regenerateSiteAction can fail on a re-run (e.g. a transient
  // API error) while leaving an EARLIER successful previewUrl untouched — the clinic's already-live,
  // still-viewable site shouldn't read as "生成失敗" just because the most recent regenerate attempt
  // didn't overwrite it with a fresh one.
  if (hearing.previewUrl) return { key: "generated", label: "生成済み", className: "bg-emerald-50 text-emerald-700" };
  if (hearing.generationError) return { key: "failed", label: "生成失敗", className: "bg-red-50 text-red-700" };
  return { key: "processing", label: "処理中", className: "bg-slate-100 text-slate-500" };
}

export async function getHearing(slug: string): Promise<HearingSheet | null> {
  const result = await d1Query<HearingRow>(`SELECT ${SELECT_COLUMNS} FROM hearings WHERE slug = ?`, [slug]);
  const row = result.results[0];
  return row ? fromRow(row) : null;
}

/** Patch type note: a key present with the value `undefined` means CLEAR, not "leave alone" — the
 * file-backed version relied on object spread for that and callers depend on it (runGeneration ends
 * with `generationStartedAt: undefined` to release the lock). `Object.keys` still reports such a key,
 * so the distinction survives here. */
export async function updateHearing(
  slug: string,
  patch: Partial<
    Pick<
      HearingSheet,
      | "previewUrl"
      | "generationError"
      | "generationStartedAt"
      | "designCheck"
      | "cloudflareUrl"
      | "cloudflareError"
      | "templateId"
      | "templateLabel"
      | "templateReason"
    >
  >
): Promise<HearingSheet | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(patch)) {
    const column = COLUMN_BY_FIELD[key];
    if (!column) continue;
    const value = (patch as Record<string, unknown>)[key];
    assignments.push(`${column} = ?`);
    values.push(value === undefined ? null : key === "designCheck" ? JSON.stringify(value) : value);
  }
  if (assignments.length > 0) {
    await d1Query(`UPDATE hearings SET ${assignments.join(", ")} WHERE slug = ?`, [...values, slug]);
  }
  return getHearing(slug);
}

/** Claims the build lock, atomically. Returns false when someone else already holds it.
 *
 * This is the reason the move to D1 is worth doing on its own. The file-backed version had to read
 * `generationStartedAt`, decide, and then write it — and two admins pressing 作成 at the same moment
 * could both pass the check before either wrote, starting two four-minute, separately-billed builds
 * that then raced to delete and rewrite the same output directory. The condition and the write are
 * one statement here, so the second caller simply loses. */
export async function claimGeneration(slug: string): Promise<boolean> {
  const result = await d1Query(
    "UPDATE hearings SET generation_started_at = ?, generation_error = NULL WHERE slug = ? AND generation_started_at IS NULL",
    [new Date().toISOString(), slug]
  );
  return result.meta.changes === 1;
}

/** Removes a hearing sheet submission (admin request management). Does not touch any already-deployed
 * generated site or Cloudflare Pages project — this only deletes the request record. */
export async function deleteHearing(slug: string): Promise<void> {
  await d1Query("DELETE FROM hearings WHERE slug = ?", [slug]);
}
