# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

An **application-intake app for individual/private clinic (個人クリニック) homepage requests**.

- A clinic owner signs up, logs in, and fills in a multi-step application form (ヒアリングシート on
  `/mypage/apply`, 12 steps — see `STEP_TITLES` in `ApplyForm.tsx`) — name, address, hours, director,
  prices, FAQ, news, uploaded photos, free-text wishes. The submission is stored and shown back on
  `/mypage/requests`.
- An admin logs in and, from `/admin`, manages users, reviews submitted applications (**view / delete
  / generate a site from / edit the generated site**), and maintains the master data the application
  form is built from (診療科・サービス・特徴・ターゲット・セクション).
- From `/admin/requests` an admin can turn one submitted sheet into a **static clinic-site bundle**
  (`public/_generated/<slug>/`) with one click — OpenAI writes the Japanese copy + section structure
  and generates the interior/portrait photos; the bundle is the same shape `/template-create`
  produces by hand and is served (behind the app login) under `/api/generated/<slug>/`. See
  `src/lib/buildSiteFromHearing.ts`, `src/lib/openai.ts`, `src/lib/generatedSite/*`.
- A generated site can then be **edited** (theme colours/fonts, section order, per-section copy, and
  photo re-generation) from `/{admin/requests,mypage/requests}/<slug>/edit` by the admin or the
  owning clinic_owner — see `src/components/siteEditor/*`, `src/lib/generatedSiteEditor.ts`, and the
  editor actions in `src/lib/contentActions.ts`. The editor edits a normalised `SiteTemplate` and
  re-renders the bundle; only a per-section copy rewrite and photo generation call OpenAI.
- `/` is a public marketing landing page.

> An **earlier, larger** AI site-generation system (per-block `SiteDocument` D1 model, template
> selection from reference-site prose, a standalone-site renderer, Cloudflare Pages publishing) was
> **removed**. There is no `SiteDocument`, no `src/lib/site`, no `src/lib/render`, no `/sites/*`
> routes — do not reintroduce those. The current generation path is only: hearing sheet → normalised
> `SiteTemplate` → static bundle, edited in place and served from `/api/generated/<slug>/`. No
> publish step, no per-block document model.

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
npm run export -- <slug>   # write a static bundle for a /preview/<slug> to public/_generated/<slug>/ (--all for every dir)
npm run preview:tunnel # cloudflared tunnel --url http://localhost:3000
npm run cf:dev / cf:deploy # wrangler dev / deploy — see "Hosting" below

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
`SUPABASE_STORAGE_BUCKET` (photo uploads — also where generated site images are stored);
`OPENAI_API_KEY` (site generation from a hearing sheet; optional `OPENAI_TEXT_MODEL` /
`OPENAI_IMAGE_MODEL` / `OPENAI_BASE_URL` overrides — defaults `gpt-4o` / `gpt-image-1`); optional
`PREVIEW_BASIC_AUTH`. With `OPENAI_API_KEY` unset the "サイト生成" button on `/admin/requests` returns
a Japanese error and nothing else breaks. With Supabase unset the site still generates but keeps the
placeholder SVGs instead of generated photos.

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
| `hearings` | `src/lib/hearing.ts` | one row per submitted application (migrations `0003`). Columns: `slug`, `owner_email`, `clinic_name`, `created_at`; everything the applicant filled in is one JSON blob in `data`, fixed at submission time. The applicant's answers have no update path (admin views/deletes only); the one mutable part is `data.generatedSite` (`{at, editedAt?, template, …}`), written by the site generator and the editor. |

### Hosting: Cloudflare Containers

Deployed with `wrangler deploy` (`wrangler.jsonc`): a thin Worker (`worker/index.ts`) forwards every
request to **one always-on container instance** (`ClincHpContainer`, a Durable Object) that runs the
Next.js `standalone` server from the `Dockerfile`. Runtime secrets are `wrangler secret put`-ed and
re-exposed as `process.env.*` in the container constructor, so the rest of the code (Server Actions,
D1/Supabase/OpenAI over HTTP, local-FS writes) runs unmodified. **The container disk is not
persistent** — `public/_generated/*` is wiped on redeploy/restart, but each bundle's source
`SiteTemplate` lives on the `hearings` row, so the editor's 保存 re-renders it without OpenAI. Some
comments in `wrangler.jsonc` / `Dockerfile` / `worker/index.ts` still name removed modules
(`SiteDocument`, `renderSiteFiles.ts`, `cloudflareDeploy.ts`) and a wrong path (`public/generated`,
real one is `public/_generated`) — stale text, not behaviour.

### Auth and access

`src/lib/auth.ts` — scrypt passwords, session cookie (`session_token`, httpOnly, 7-day TTL), D1
`sessions`. Two roles: `admin`, `clinic_owner`.

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

- Public: `/` (landing), `/login`, `/signup`; `/preview/<slug>` (hand-built template previews, behind
  the `PREVIEW_BASIC_AUTH` gate when set)
- Clinic owner (`clinic_owner` session): `/home`, `/mypage/apply`, `/mypage/requests`,
  `/mypage/requests/[slug]/edit` (+ `/[section]`) — generated-site editor for their own request
- Admin (`admin` session): `/admin` (login), `/admin/dashboard`, `/admin/users`, `/admin/requests`,
  `/admin/requests/[slug]/edit` (+ `/[section]`), `/admin/departments` (+ `/[id]`), `/admin/features`,
  `/admin/targets`, `/admin/sections`
- API routes: `POST /api/uploads` (photo → Supabase), `GET /api/generated/<slug>/[[...path]]`
  (serves a generated bundle; any signed-in session)

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
back-compat shapes the section components still consume (`clinic`, `treatments`, `layout`, …) built
from the JSON in that same file. `data/sections.ts` just re-exports `layout` + the `SectionType` /
`SectionConfig` types. (There is no longer a `data/clinic.ts` or `data/departments.ts`.)
**To make a new site: copy `template.json`, edit values, done**
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
assembled. CSS rules that belong only to a section module the page never renders are dropped.
`js/motion.js` is `public/nj-motion.js` copied verbatim (the page's `<script>` is stripped from the
extracted body and re-added pointing at the local file). `<link>`/`<script>` order in `index.html`:
fonts → site → ui → sections → motion.js. `--all` exports every `src/app/preview/*` dir. Output is
gitignored.

### The generated-site bundle (hearing sheet → static files)

Two code paths produce the same `nj-site` look; don't confuse them:

- **`/preview/<slug>`** — hand-authored, React section components + CSS Modules, content from
  `data/template.json`. Turned into plain files by `scripts/export-static.mjs` (above). This is the
  `/template-create` path.
- **`public/_generated/<slug>/`** — per-hearing, built by **string templating** in
  `src/lib/generatedSite/render.ts` (`renderBundle(template)` → `{index.html, css/*, js/site.js,
  html/*, assets/*, template.json, README.md}`). CSS/JS are the same for every site
  (`src/lib/generatedSite/staticAssets.ts`); all per-clinic variation is the section HTML and the
  inline `--nj-*` custom properties. `src/lib/generatedSite/normalize.ts` coerces OpenAI's raw JSON
  (or an edited template) into a complete `SiteTemplate` and enforces three guardrails: readable
  contrast, a Japanese-capable font, and a baseline section set (`trustLayout: true` skips the last
  one so the editor never re-adds sections). `src/lib/generatedSite/types.ts` is the `SiteTemplate`
  shape; `color.ts` / `fonts.ts` back the guardrails. Served by
  `src/app/api/generated/[slug]/[[...path]]/route.ts` (any signed-in session; injects a `<base>`;
  `no-store`, `noindex`).

## Docs

- `docs/SPEC.md` — full implementation spec (roles, D1 schema, every route + Server Action, the
  hearing-sheet → bundle generator, the editor, the two `nj-site` render paths, known debt). Written
  from source; keep it in sync when behaviour changes.
- `docs/Clinc-HP_事業説明資料.docx` — business overview.

The earlier written spec / screen doc / test-case suite described the removed site-generation system
and were deleted.
