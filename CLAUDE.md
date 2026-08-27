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
| `departments`, `services`, `features`, `targets` | `src/lib/content.ts` | admin-managed master data / taxonomy for the application form |
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
  `/admin/departments` (+ `/[id]`), `/admin/features`, `/admin/targets`

App-shell screens use Tailwind (`src/app/globals.css`).

## Docs

`docs/` holds only `Clinc-HP_事業説明資料.docx` (business overview). The earlier system spec / screen
doc / test-case suite described the removed site-generation system and were deleted.
