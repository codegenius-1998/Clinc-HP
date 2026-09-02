-- Admin-managed "section" master — a flat name-only taxonomy, same shape as `features` / `targets`
-- (see 0002_create_content_tables.sql). Managed from /admin/sections.

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
