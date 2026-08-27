-- Site-build applications (ヒアリングシート) submitted from /mypage/apply.
--
-- `slug` / `owner_email` / `clinic_name` / `created_at` are their own columns; everything the
-- applicant filled in — address, hours, staff, prices, FAQ, uploaded photo URLs — is one JSON blob
-- in `data`, fixed at submission time. An admin only views and deletes these (see
-- src/lib/hearing.ts, src/app/admin/(dashboard)/requests).

CREATE TABLE IF NOT EXISTS hearings (
  slug TEXT PRIMARY KEY,
  owner_email TEXT,
  clinic_name TEXT,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hearings_owner_email ON hearings(owner_email);
CREATE INDEX IF NOT EXISTS idx_hearings_created_at ON hearings(created_at);
