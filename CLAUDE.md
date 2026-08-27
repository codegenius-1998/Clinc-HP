# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

An **application-intake app for individual/private clinic (個人クリニック) homepage requests**.

- A clinic owner signs up, logs in, and fills in a 10-step application form (ヒアリングシート on
  `/mypage/apply`) — name, address, hours, staff, prices, uploaded photos, free-text wishes. The
  submission is stored and shown back on `/mypage/requests`.
- An admin logs in and, from `/admin`, manages users, reviews submitted applications (**view / delete
  only**), and maintains the master data the application form is built from (診療科・サービス・特徴・
  ターゲット).
- `/` is a public marketing landing page.

> The AI site-generation half of this project (template selection, content/image generation, the
> standalone-site renderer, the visual editor, Cloudflare Pages publishing) was **removed**. There is
> no `SiteDocument`, no `src/lib/site`, no `src/lib/render`, no `src/lib/openai`, no `/sites/*` routes.
> Do not reintroduce them.

All user-facing strings (UI labels, validation messages, thrown `Error` messages) are **Japanese** —
errors surface directly in the UI. Code comments are English.

## Commands

```bash
npm run dev            # Next.js dev server (Turbopack)
npm run build          # production build (output: "standalone")
npm start              # run the production build
npm run lint           # eslint
npx tsc --noEmit       # typecheck
npm run clean          # rm -rf .next tsconfig.tsbuildinfo — the fix for stale Turbopack / route-type errors
npm run preview:tunnel # cloudflared tunnel --url http://localhost:3000

node scripts/migrate.mjs                      # apply migrations/*.sql to D1 over the HTTP API
node scripts/migrate.mjs --file 0003_...sql   # apply one migration
node scripts/seed-admin.mjs <email> <pw> [admin|clinic_owner]  # prints an INSERT for `users`
```

**There is no test framework** — no `test` script, no runner installed. Verification is manual:
`npx tsc --noEmit && npm run lint && npm run build`, plus exercising the flow in the dev server. When
a change needs data-level proof, write a throwaway script in the scratchpad that replays the logic
against real D1 rows.

## Environment

`.env.local` supplies: `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_D1_DATABASE_ID`
(D1); `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (falls back to `SUPABASE_ANON_KEY`) + optional
`SUPABASE_STORAGE_BUCKET` (photo uploads); optional `PREVIEW_BASIC_AUTH`.

## Architecture

### Persistence: Cloudflare D1 over HTTP

`src/lib/d1.ts` talks to the D1 REST API (this runs as a normal Node server, not a Worker) and sends
**one statement per round trip**. Schema lives in `migrations/`, applied by `scripts/migrate.mjs`
(idempotent by construction — `IF NOT EXISTS` / `INSERT OR IGNORE`; `ALTER TABLE ADD COLUMN` is
allowed to fail with "duplicate column").

Tables:

| Table | Module | What it holds |
|---|---|---|
| `users`, `sessions` | `src/lib/auth.ts` | auth (scrypt password, session cookie) |
| `departments`, `services`, `features`, `targets`, `sections` | `src/lib/content.ts` | admin-managed master data / taxonomy for the application form |
| `hearings` | `src/lib/hearing.ts` | one row per submitted application. Columns: `slug`, `owner_email`, `clinic_name`, `created_at`; everything the applicant filled in is one JSON blob in `data`, fixed at submission time. Admin views/deletes only — there is no update path. |

### Auth and access

`src/lib/auth.ts` — scrypt passwords, session cookie, D1 `sessions`. Two roles: `admin`,
`clinic_owner`.

**Server Actions are directly POST-able endpoints, so a page-level guard protects nothing.**
`requireAdmin()` (`src/lib/auth.ts`) must be at the *top of every admin action* in
`src/lib/contentActions.ts`, not only where the page renders. Owner actions
(`src/lib/applicationActions.ts`) re-check `getSession()` and, for deletes, that the row's
`ownerEmail` matches the session.

`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) is HTTP Basic auth over the whole app
for tunnel demos, gated on `PREVIEW_BASIC_AUTH`. It is a gate on the *preview*, not a replacement for
the app's login. **Never put credentials in the tunnel URL** (`https://user:pass@host`) — Chrome
refuses to construct a `fetch` from it and every Server Action breaks.

### Photo uploads

`POST /api/uploads` (`src/app/api/uploads/route.ts`) validates images against
`src/lib/imageFormats.ts` and stores them in **Supabase Storage** (`src/lib/supabaseStorage.ts`, raw
REST, no SDK). The application form (`src/components/apply/ApplyForm.tsx`) posts photos here and keeps
the returned public URLs in the submission's `uploadedImages`. `src/lib/imageCategories.ts` is the
shared category list.

### The landing page

`src/app/page.tsx` is self-contained under `src/components/landing/*` and `src/components/ui/*`. It
optionally reads `public/landing/templates.json` for a showcase strip and hides that section when the
file is absent. It touches no D1 write path and no removed module.

### Screens

- Public: `/` (landing), `/login`, `/signup`
- Clinic owner (`clinic_owner` session): `/home`, `/mypage/apply`, `/mypage/requests`
- Admin (`admin` session): `/admin` (login), `/admin/dashboard`, `/admin/users`, `/admin/requests`,
  `/admin/departments` (+ `/[id]`), `/admin/features`, `/admin/targets`, `/admin/sections`

App-shell screens use Tailwind (`src/app/globals.css`).

### Clinic-site previews and static export

`src/app/preview/<slug>/page.tsx` renders a standalone clinic homepage, fully scoped under
`<div class="nj-site">` — its own tokens/resets in `src/components/sections/site.css`, sections as
`src/components/sections/<Name>/` (`.tsx` + CSS Module) resolved through `registry.ts`.

**Everything content-shaped is one JSON: `src/components/sections/data/template.json`** (schema:
`template.schema.json`). It holds `meta`, `theme` (`colors` + `fonts`), `brand`, `contact`, `layout`
(`{type, variant}[]`), `nav`, and `sections.<name>` (headings, copy, list items, and `image` slots
`{src, alt}` — `src: null` ⇒ the built-in placeholder SVG). `data/template.ts` types it and exposes:
`themeStyle` (inline `--nj-*` CSS vars for the `.nj-site` div — overrides `site.css` defaults),
`fontHref` (Google-Fonts `<link>` built from `theme.fonts`), `content` (per-section, typed), plus
back-compat `clinic` / `treatments` / `layout` re-exported by `data/{clinic,departments,sections}.ts`
(thin shims — don't add logic there). **To make a new site: copy `template.json`, edit values, done**
— section components take no hardcoded strings. The `layout` mirrors the D1 `sections` master
(ファーストビュー→`hero`, 診療内容→`medical`, 料金→`fees`, …; `header`/`footer`/`schedule` are
structural); `nav` is kept 1:1 with the section anchors.

**All imagery is inline SVG unless `template.json` supplies an image `src`** — decorative line-art
icons come from `src/components/sections/ui/Illustration.tsx` (`name` → SVG, `currentColor`), used in
`Medical` and `Reasons` (icon name per item in the JSON). Nothing here touches the app's
D1/auth/Tailwind.

One small progressive-enhancement script, `public/nj-motion.js` (no deps), loaded by `page.tsx` as
`<script src="/nj-motion.js" defer>`: scroll-reveal via `IntersectionObserver` (`.nj-reveal` /
`[data-nj-anim]` → `.is-visible`, `site.css` holds the `.nj-js`-gated initial state), `[data-nj-count]`
count-up, header shadow + `.nj-progress` scroll bar + `[data-nj-parallax]` hero, and anchor-click
scroll that subtracts the sticky-header height (measured into `--nj-header-h`; `#top` goes to page
top) + mobile-menu close. No scroll-spy / active-nav highlight — deliberately removed. The site
renders fully without it (menu is still CSS `:checked`); `prefers-reduced-motion` disables the motion.
Pure-CSS decoration (no JS): `@keyframes nj-twinkle` sparkles on every `SectionHeading` + the hero
(4-point stars carrying the global class `nj-spark` — global so CSS-Modules doesn't rename the
animation), `@keyframes nj-float` bob on `.nj-float` illustrations, and a `blur(6px)→0` on reveal.
All in `site.css`, all `prefers-reduced-motion`-gated.

To hand a preview to a client as plain files:

```bash
npm run build && npm run start        # another terminal, port 3000
npm run export -- <slug>              # → public/_generated/<slug>/
```

`scripts/export-static.mjs` fetches `/preview/<slug>` from the running server (sending
`PREVIEW_BASIC_AUTH`), strips every Next.js artefact, keeps the Google-Fonts `<link>` (found by its
`data-nj-font` marker) as a CDN reference, and writes a clean `index.html`. The theme travels with
the export as the inline `style="--nj-*: …"` on the `.nj-site` div (no build step needed for a
re-themed `template.json` — just re-export). **CSS, JS and HTML are split per section** (spec): the
`.nj-site` CSS bundle (identified by content — NOT `globals.css`) is partitioned back into
`css/site.css` (tokens/resets), `css/ui.css` (Container/SectionHeading), and one
`css/<section>.css` per section actually used — split on the dev build's per-file comment markers,
with a `<Name>-module__` prefix fallback for minified prod builds. `html/<section>.html` holds each
top-level `.nj-site` child's raw markup (keyed the same `<Name>-module__` way; `<header>`/`<footer>`
by tag), each prefixed with the `<header>` menu so it stands alone — `index.html` itself is left
assembled. Unused modules (`HeroSplit`, `Button`) are dropped.
`js/motion.js` is `public/nj-motion.js` copied verbatim (the page's `<script>` is stripped from the
extracted body and re-added pointing at the local file). `<link>`/`<script>` order in `index.html`:
fonts → site → ui → sections → motion.js. `--all` exports every `src/app/preview/*` dir. Output is
gitignored.

## Docs

`docs/` holds only `Clinc-HP_事業説明資料.docx` (business overview). The earlier system spec / screen
doc / test-case suite described the removed site-generation system and were deleted.
