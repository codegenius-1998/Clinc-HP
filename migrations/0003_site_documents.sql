-- SiteDocument model: templates and generated clinic sites are the SAME shape, distinguished only by
-- `sites.is_template`. That is what lets one editor screen and one renderer serve both (see
-- src/lib/site/document.ts). This migration extends the tables created in 0002 rather than adding
-- new ones — `sites.is_template` and `site_sections.position` were already exactly the right shape.

-- --- sites: now carries the design tokens + meta that used to live in hp-templates/*.json ---
ALTER TABLE sites ADD COLUMN slug TEXT;
ALTER TABLE sites ADD COLUMN owner_email TEXT;
-- For a generated site: which template it was cloned from (chosen by AI, see selectTemplate.ts).
ALTER TABLE sites ADD COLUMN template_id TEXT;
-- JSON DesignTokens — colors/font/block/layout/animation. Replaces hp-templates/presets + colors.json.
ALTER TABLE sites ADD COLUMN design TEXT;
-- JSON SiteMeta — clinic name, phone, line, address, SEO fields.
ALTER TABLE sites ADD COLUMN meta TEXT;
-- Free-text mood description. Only meaningful on templates: this is what the AI reads when picking a
-- template for a hearing sheet, so it must describe atmosphere, not markup.
ALTER TABLE sites ADD COLUMN mood TEXT;
-- JSON string[] — "小児科向け", "審美系" etc. Coarse pre-filter before the AI's judgement call.
ALTER TABLE sites ADD COLUMN tags TEXT;
ALTER TABLE sites ADD COLUMN source_url TEXT;
ALTER TABLE sites ADD COLUMN thumbnail_url TEXT;
ALTER TABLE sites ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
CREATE INDEX IF NOT EXISTS idx_sites_owner_email ON sites(owner_email);
CREATE INDEX IF NOT EXISTS idx_sites_template_id ON sites(template_id);

-- --- site_sections: one row per BLOCK instance, in `position` order ---
-- `sec_id` is the block TYPE (see the seed below); `id` is the block INSTANCE id. Keeping them
-- separate is what allows the same type to appear more than once on a page.
ALTER TABLE site_sections ADD COLUMN visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE site_sections ADD COLUMN nav_label TEXT;

-- --- fixed block-type catalog ---
-- Section TYPES are fixed (a code-side registry, src/lib/site/blocks.ts, is the source of truth);
-- only their count and order are free. These rows exist so site_sections.sec_id's foreign key
-- resolves and so the admin screens can show a human-readable name.
INSERT OR IGNORE INTO sections (id, name) VALUES ('hero', 'メインビジュアル');
INSERT OR IGNORE INTO sections (id, name) VALUES ('rich', '文章＋カード');
INSERT OR IGNORE INTO sections (id, name) VALUES ('hours', '診療時間');
INSERT OR IGNORE INTO sections (id, name) VALUES ('access', 'アクセス');
INSERT OR IGNORE INTO sections (id, name) VALUES ('news', 'お知らせ');
INSERT OR IGNORE INTO sections (id, name) VALUES ('staff', 'スタッフ紹介');
INSERT OR IGNORE INTO sections (id, name) VALUES ('faq', 'よくある質問');
INSERT OR IGNORE INTO sections (id, name) VALUES ('pricing', '料金表');
INSERT OR IGNORE INTO sections (id, name) VALUES ('contact', 'お問い合わせ');
INSERT OR IGNORE INTO sections (id, name) VALUES ('freeText', '自由文');
INSERT OR IGNORE INTO sections (id, name) VALUES ('imageBanner', '画像バナー');
INSERT OR IGNORE INTO sections (id, name) VALUES ('gallery', '写真ギャラリー');
