-- Per-block presentation had nowhere to live, so it was silently discarded on every save.
--
-- `site_sections` carried exactly seven columns (id / sec_id / site_id / content / position /
-- visible / nav_label) and `content` held only `block.data`. Everything else a Block carries —
-- `variant`, `spacing`, `textStyles`, `containerStyles` — was written by the code, validated by the
-- schema, and then dropped on the floor by saveDocument. Two consequences, both live:
--
--   * The per-section layouts applyComposition assigns during a build survived exactly one render.
--     Reload the document and every section reverted to the template's single cardLayout — which is
--     why every generated site looked like every other site built from the same template.
--   * Text styling applied in the visual editor was gone the next time the editor was opened. That
--     one is straightforward data loss and nobody had reported it.
--
-- Measured before this migration: 74 stored block rows, 0 containing "variant" or "textStyles".
--
-- ⚠️ One JSON column rather than four typed ones. `textStyles` and `containerStyles` are
-- `z.record` — arbitrary key sets — so they can only ever be JSON; nothing filters or sorts on any
-- of these in SQL; and every presentational field added later (cardCount, ornament opt-ins) then
-- persists with no further migration and no further edit to store.ts. The one obligation this
-- creates is keeping BLOCK_COLUMN_FIELDS in step, which is stated where it is defined.
ALTER TABLE site_sections ADD COLUMN attrs TEXT;

-- The document-level counterpart: `metaTextStyles` and `chromeSpacing` (document.ts) style the
-- header/footer chrome, which lives in `meta` rather than in any block and so has no row of its own.
-- Declared since the visual editor shipped and persisted by nothing.
ALTER TABLE sites ADD COLUMN chrome TEXT;
