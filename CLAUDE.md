# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

An AI site builder for **individual/private clinics (個人クリニック)**. A clinic owner fills in a
10-step application form (ヒアリングシート) — name, address, hours, staff, prices, free-text wishes —
and an admin presses 作成. From that, OpenAI plans the page copy and generates ~20 images, and the app
writes a complete standalone static homepage to `public/generated/<slug>/`, which can then be tuned
in a visual editor and published to Cloudflare Pages.

All user-facing strings (UI labels, validation messages, thrown `Error` messages) are **Japanese** —
errors surface directly in the UI. Code comments are English.

## Commands

```bash
npm run dev            # Next.js dev server (Turbopack)
npm run build          # production build (output: "standalone")
npm start              # run the production build
npm run lint           # eslint
npx tsc --noEmit       # typecheck
npm run clean          # rm -rf .next — the fix for "FATAL: An unexpected Turbopack error"
npm run preview:tunnel # cloudflared tunnel --url http://localhost:3000

node scripts/migrate.mjs                    # apply migrations/*.sql to D1 over the HTTP API
node scripts/migrate.mjs --file 0003_...sql # apply one migration
node scripts/seed-admin.mjs <email> <pw> [admin|clinic_owner]  # prints an INSERT for `users`
```

**There is no test framework** — no `test` script, no runner installed. Verification is manual, using
`docs/TESTCASES.md`. When a change needs proof, prefer a throwaway script in the scratchpad that
replays the logic against real D1 rows over running a full generation, which costs money and ~4
minutes.

## Environment

`.env.local` supplies: `OPENAI_API_KEY`; `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_D1_DATABASE_ID`; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (falls back to
`SUPABASE_ANON_KEY`) + optional `SUPABASE_STORAGE_BUCKET`; optional `PREVIEW_BASIC_AUTH`.

## Architecture

### `SiteDocument` is the whole data model

`src/lib/site/document.ts` defines one zod-validated shape used for **both a design template and a
generated clinic site** — `isTemplate` is the only discriminator. That equality is load-bearing: one
renderer serves both (a template preview is pixel-identical to the site it produces), one editor
screen edits both, and "make a site from a template" is a clone plus a content swap
(`instantiateTemplate` in `src/lib/site/store.ts`), not a separate code path.

A document is `{ design tokens, meta, blocks[] }`. Blocks are a discriminated union on `type`
(`hero`, `rich`, `staff`, `hours`, `pricing`, `news`, `faq`, `gallery`, `imageBanner`, `contact`, …).

**Adding a field to a block or to the design tokens requires `.default()`** — `getDocument()`
`safeParse`s and falls back to `DEFAULT_DESIGN_TOKENS` *wholesale* on failure, so a newly-required
field silently wipes every existing site's design.

### Built-in templates are JSON, not code

`src/lib/site/templates/*.json` — one file per template, holding its structure, palette, decoration,
its own fictional clinic and its own sample copy. The shape is `siteDocumentSchema` minus the
database's fields, so there is no second schema to keep in step. **Adding a template is a JSON file
plus one line in `templates/index.ts`; no TypeScript logic is involved.**

The import line is not optional and forgetting it is silent — `output: "standalone"` will not trace a
file nothing imports, so a runtime read would work in dev and find nothing in production.
`scripts/verify-templates.mts` compares the directory against the registry and fails on either
mismatch. `archetypes.ts` is a thin view over this library, kept only so its five callers did not
have to change.

⚠️ **Each template's sample copy is its own.** They used to share one set of words, so two templates
could differ only by colour, typeface and section order — every word a reader's eye landed on was
identical. `applySampleCopy` (generic, free) still exists as the fallback for a structure borrowed by
the URL importer; `generateSampleCopy` writes a fresh one, in a model call that is never shown the
reference site.

### A template's own CSS/JS is a NAME, never the code

`src/lib/render/kits/<key>.ts` holds one template's bespoke CSS (and optionally JS); a document
stores only `design.layout.styleKit`, the key. That is a security boundary, not a style preference:
`SiteDocument` is the same shape for a template and a real clinic's site and `instantiateTemplate`
clones one into the other, so a field holding raw JS would be a field the URL importer — a model
reading an arbitrary third-party website — could fill, ending up inside a published medical
practice's page. Untrusted input can only ever *name* something that exists in the repository; an
unknown key resolves to nothing, exactly like an unrecognised `variant`.

Kits draw on `.ornament` (already `absolute; inset: 0; pointer-events: none` inside an
`overflow-x: clip` box). ⚠️ **A template using an ornament-drawing kit must set `layout.ornament`
and `animation.ambient` to `"none"`** — site.css's rules for those are specificity (0,3,1) and a kit
cannot beat them, so the two silently fight over the same layer. `scripts/verify-templates.mts`
enforces that, along with the rest of the kit safety rules.

### Making a template from a reference URL

`/template-from-url <URL>` (`.claude/skills/template-from-url/SKILL.md`) is the Claude Code procedure
for this — it measures the rendered page in a real browser and hand-writes the JSON, as opposed to
`importFromUrl.ts`, which is the in-app feature that parses HTML/CSS as text. Both stay. The rule the
skill turns on: **the reference site sets the impression, `frontend-design` sets the concrete
values** — nothing of the reference's words, images, hexes or typeface names enters the template.

### Persistence: Cloudflare D1 over HTTP

`src/lib/d1.ts` talks to the D1 REST API (this runs as a normal Node server, not a Worker), and
**sends exactly one statement per round trip**. Write paths in `store.ts` are therefore shaped as a
few batched statements, not one per block. Schema lives in `migrations/`.

Mapping: `sites` (one row per document) + `site_sections` (one row per block, `position`-ordered,
`id` = `"<siteId>:<block.id>"`, `sec_id` = block type, `content` = block data JSON).

Application/hearing data is **not** in D1 — it is JSON files under `data/hearings/<slug>.json`
(`src/lib/hearing.ts`). The admin master data (departments, services, features, targets, sections) is
in D1 via `src/lib/content.ts`.

### The generation pipeline

`src/lib/siteGenerator.ts` `generateSite(hearing)` is the spine; read it before touching anything AI:

1. `selectTemplate` — AI picks a template from the sellable ones and records why.
2. `instantiateTemplate` — clone. **Reuses an existing document's `id` when the slug already exists**,
   or the final `saveDocument` fails on `UNIQUE constraint failed: sites.slug` after several minutes
   and ~20 billed images.
3. `generateContentPlan` + `polishStaffComments` in parallel (two model calls, no interdependency).
4. `applyFactualContent` — phone/address/hours/prices/staff/FAQ/news come from the hearing sheet
   **verbatim**; the AI may only invent news and FAQ, and only when the clinic supplied none.
5. `rm(outDir)` then `buildImageJobs` → `produceImages` → `applyImagePaths`.
   The output directory is **wiped first**, and `instantiateTemplate` copies image *paths* without
   copying the *files*, so every image path a document still carries must have a job — that is what
   `buildImageJobs`' gap-filling loop guarantees. Uploaded clinic photos beat generated ones.
6. `saveDocument` → `renderSiteFiles`.

Generation takes ~4 minutes and costs real money. It is started as fire-and-forget
(`void runGeneration(slug)` in `src/lib/contentActions.ts`) with `generationStartedAt` as the lock,
because **Cloudflare's 100-second origin response limit** cuts any Server Action that waits for it.
The detail page polls via `AutoRefresh`. This only works because the app is a long-lived Node server.

### Rendering

`src/lib/render/renderSiteFiles.ts` writes `index.html` + `css/site.css` + `js/main.js` into
`public/generated/<slug>/` (templates go to `public/generated/_templates/<id>/`). It calls **no AI and
touches no image**, which is why saving in the editor is instant and free — and it deliberately never
removes the output directory, since `images/` is not reproducible from the document.

`components.tsx` is a plain React tree rendered to static HTML. `data-block-id` / `data-field`
attributes on elements are the join between the rendered page and the editor's click-to-select
(`fieldPath.ts`); dropping them breaks visual editing. `site.css` is hand-written, not Tailwind
(Tailwind is only used for the app's own admin/owner screens).

### Auth and access

`src/lib/auth.ts` — scrypt passwords, session cookie, D1 `sessions`. Two roles: `admin`,
`clinic_owner`.

**Server Actions are directly POST-able endpoints, so a page-level guard protects nothing.**
`requireAdmin()` / `requireEditableDocument()` (`src/lib/site/access.ts`) must be at the *top of every
action*, not only where the page renders. Templates are admin-only; a generated site is editable by
its `ownerEmail` and by any admin.

`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) is HTTP Basic auth over the whole app
for tunnel demos, gated on `PREVIEW_BASIC_AUTH`. It is a gate on the *preview*, not a replacement for
the app's login. **Never put credentials in the tunnel URL** (`https://user:pass@host`) — Chrome
refuses to construct a `fetch` from it and every Server Action breaks.

### External services

- **OpenAI** (`src/lib/openai/`): Responses API + `zodTextFormat` for structured output, `gpt-5.6-terra`
  for text; images use `gpt-image-2`, except transparent logos which need `gpt-image-1`.
- **Supabase Storage** (`src/lib/supabaseStorage.ts`): raw REST, no SDK. Holds user *uploads*;
  generated site files stay on local disk. (R2 was removed — do not reintroduce it.)
- **Cloudflare Pages** (`src/lib/cloudflareDeploy.ts`): shells out to `wrangler pages deploy`.
- **Template import from a URL** (`src/lib/template/importFromUrl.ts`) goes through
  `safeFetch.ts`, which blocks non-http schemes, localhost/`.local`/`.internal`, private IP ranges,
  and re-checks after redirects. Do not weaken it. Reference-site images are shown to the model as
  URLs only — never downloaded or stored (copyright).

## Docs

`docs/SPEC.md` is the verified system spec (ch. 12 known constraints, ch. 13 known debt),
`docs/SCREENS.md` the screen-by-screen design doc, `docs/TESTCASES.md` the manual test suite. They are
Japanese and are expected to be kept in step with behaviour changes.
