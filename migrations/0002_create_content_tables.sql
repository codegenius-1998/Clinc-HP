-- Content model for admin-managed templates/sites and taxonomy lookups.
-- `users` already exists (see 0001_create_auth_tables.sql) and is intentionally not touched here.

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_template INTEGER NOT NULL DEFAULT 0,
  can_sell INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_sections (
  id TEXT PRIMARY KEY,
  sec_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  content TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_site_sections_site_id ON site_sections(site_id);
CREATE INDEX IF NOT EXISTS idx_site_sections_sec_id ON site_sections(sec_id);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_department_id ON services(department_id);

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
