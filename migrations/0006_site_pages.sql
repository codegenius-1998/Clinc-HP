-- Multi-page sites. A SiteDocument used to render to exactly one index.html with every section on
-- it and a nav made of `#anchor` links; a clinic homepage is conventionally six or so real pages.
--
-- ⚠️ Blocks stay ONE flat array. A page is a label a block points at, not a container it lives in —
-- which is why `position` stays document-wide (rendering filters by page and preserves the relative
-- order) and why no existing row has to move. There is exactly one ordering, as before.
--
-- ⚠️ NULL page_id means the home page, so every row written before this migration keeps rendering
-- exactly where it already did. That is the whole backward-compatibility story: existing templates
-- and existing published sites stay one page, and their URLs do not change.
ALTER TABLE sites ADD COLUMN pages TEXT;            -- JSON PageDef[]
ALTER TABLE site_sections ADD COLUMN page_id TEXT;  -- NULL = the home page

CREATE INDEX IF NOT EXISTS idx_site_sections_page ON site_sections(site_id, page_id, position);
