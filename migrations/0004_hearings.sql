-- Hearing sheets move from data/hearings/*.json into D1.
--
-- They were the last piece of customer-submitted data living on the server's local disk, which made
-- the whole application single-machine by construction: the instance that received an application was
-- the only one that could ever read it back. It also meant the two halves of one record — the
-- application (a file) and the site built from it (a D1 row) — could drift apart, and they had:
-- four of seven generated sites had no hearing sheet left at all.
--
-- Column layout follows `sites`: the fields that get WRITTEN AFTER submission become columns, and the
-- application form's own contents stay as one JSON blob. That split is not cosmetic —
-- `updateHearing`'s patch type lists exactly the mutable fields, so this makes every update a single
-- statement instead of a read-modify-write, and it makes `generation_started_at` something a
-- conditional UPDATE can claim atomically (see claimGeneration in src/lib/hearing.ts).
--
-- ⚠️ Written as CREATE-then-ALTER, not as a plain CREATE. A `hearings` table with a minimal shape
-- (slug / owner_email / created_at / data) already existed in the database — created by hand, since
-- no migration here makes one — so CREATE TABLE IF NOT EXISTS alone would have silently left the new
-- columns missing. The ALTERs bring that table up to this schema; on a fresh database they all fail
-- with "duplicate column name", which scripts/migrate.mjs is built to ignore. Both paths end at the
-- same schema, which is why the CREATE below declares no NOT NULL that an ALTER could not add.

CREATE TABLE IF NOT EXISTS hearings (
  -- Same slug that identifies the generated site (`sites.slug`) and its output directory.
  slug TEXT PRIMARY KEY,
  -- The clinic_owner who submitted it. Nullable: applications made through the old, unauthenticated
  -- /create flow (deleted 2026-08-21) have none.
  owner_email TEXT,
  created_at TEXT NOT NULL,
  clinic_name TEXT,

  -- Which template the AI chose, and why. Unset until a build has run — `hearingStatus` reads this
  -- to tell an unapproved application from a built one.
  template_id TEXT,
  template_label TEXT,
  template_reason TEXT,

  preview_url TEXT,
  generation_error TEXT,
  -- The build lock. Non-null means a build is running; a conditional UPDATE on this column is what
  -- makes "press 作成 twice" impossible rather than merely unlikely.
  generation_started_at TEXT,
  -- JSON { high, medium, low, checkedAt } from the design check run at the end of the last build.
  design_check TEXT,

  cloudflare_url TEXT,
  cloudflare_error TEXT,

  -- JSON: everything the applicant filled in and nothing else — address, hours, staff, prices, FAQ,
  -- uploaded photo URLs. Fixed at submission time, so it is never partially updated.
  data TEXT NOT NULL
);

-- Upgrade path for the pre-existing minimal table. Each of these is a no-op on a fresh database.
ALTER TABLE hearings ADD COLUMN clinic_name TEXT;
ALTER TABLE hearings ADD COLUMN template_id TEXT;
ALTER TABLE hearings ADD COLUMN template_label TEXT;
ALTER TABLE hearings ADD COLUMN template_reason TEXT;
ALTER TABLE hearings ADD COLUMN preview_url TEXT;
ALTER TABLE hearings ADD COLUMN generation_error TEXT;
ALTER TABLE hearings ADD COLUMN generation_started_at TEXT;
ALTER TABLE hearings ADD COLUMN design_check TEXT;
ALTER TABLE hearings ADD COLUMN cloudflare_url TEXT;
ALTER TABLE hearings ADD COLUMN cloudflare_error TEXT;

CREATE INDEX IF NOT EXISTS idx_hearings_owner_email ON hearings(owner_email);
CREATE INDEX IF NOT EXISTS idx_hearings_created_at ON hearings(created_at);
