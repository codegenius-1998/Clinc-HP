import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";
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

/** The current clinic_owner's own submissions only — powers /mypage's 申請一覧・サイト一覧, which
 * (unlike /admin/requests) must never show another clinic's data. */
export async function listHearingsByOwner(ownerEmail: string): Promise<HearingSheet[]> {
  const all = await listHearings();
  return all.filter((h) => h.ownerEmail === ownerEmail);
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
  try {
    const raw = await readFile(path.join(DATA_DIR, `${slug}.json`), "utf-8");
    return JSON.parse(raw) as HearingSheet;
  } catch {
    return null;
  }
}

export async function updateHearing(
  slug: string,
  patch: Partial<
    Pick<
      HearingSheet,
      | "previewUrl"
      | "generationError"
      | "generationStartedAt"
      | "cloudflareUrl"
      | "cloudflareError"
      | "templateId"
      | "templateLabel"
      | "templateReason"
    >
  >
): Promise<HearingSheet | null> {
  const hearing = await getHearing(slug);
  if (!hearing) {
    return null;
  }
  const updated: HearingSheet = { ...hearing, ...patch };
  await writeFile(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

/** Removes a hearing sheet submission (admin request management). Does not touch any already-deployed
 * generated site or Cloudflare Pages project — this only deletes the request record. */
export async function deleteHearing(slug: string): Promise<void> {
  await rm(path.join(DATA_DIR, `${slug}.json`), { force: true });
}
