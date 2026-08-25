---
name: nextjs
description: Version-locked Next.js reference for this repo. Routes you to the real Next.js 16.3 docs bundled inside node_modules instead of trusting pretrained knowledge, which is out of date for this version (Middleware was renamed Proxy, caching and `use cache` changed, config keys moved). Use this whenever you are about to write or change anything Next.js in this repo — App Router pages and layouts, Server Actions, `proxy.ts`/middleware, route handlers under `src/app/api/`, `next.config.ts`, caching and revalidation, `generateMetadata`, `<Image>`/`<Link>`/`<Form>`, dynamic APIs like `cookies()` and `headers()`, or build/dev/Turbopack errors — and also when a Next.js API you remember does not behave as expected.
---

# Next.js (this repo's exact version)

This repo pins **Next.js 16.3.0**, and the version that ships with it carries its own
documentation. Confirm the version before you rely on anything here:

```bash
node -p "require('next/package.json').version"
```

Model knowledge of Next.js is unreliable across major versions — APIs get renamed, defaults flip, and
config keys move. The bundled docs are the ground truth for *this* install, so read them first and
write code against what they say, not against what you remember. Heed deprecation notices you see
there.

## Where the docs are

```
node_modules/next/dist/docs/
├── index.md
├── 01-app/                      ← App Router. This repo uses it exclusively.
│   ├── 01-getting-started/      ← concept-first walkthroughs, numbered in reading order
│   ├── 02-guides/               ← task-shaped ("authentication", "forms", "self-hosting")
│   ├── 03-api-reference/        ← the precise contracts
│   │   ├── 01-directives/       ← "use client", "use server", "use cache"
│   │   ├── 02-components/       ← image, link, form, font, script
│   │   ├── 03-file-conventions/ ← page, layout, route, proxy, error, loading, metadata
│   │   ├── 04-functions/        ← cookies, headers, redirect, revalidatePath, after, …
│   │   ├── 05-config/           ← next.config.js keys, typescript, eslint
│   │   └── 06-cli/              ← next dev / build / start flags
│   └── 04-glossary.md
├── 02-pages/                    ← Pages Router. Not used here — ignore unless migrating.
└── 03-architecture/
```

Resolve that path from the file that pointed you here, not from the repo root — in a monorepo the
`next` package may not be hoisted to the top level.

## How to look something up

Start from the filename when you know the API, and fall back to search when you don't:

```bash
D=node_modules/next/dist/docs
ls $D/01-app/03-api-reference/04-functions/          # what functions exist at all
sed -n '1,80p' $D/01-app/03-api-reference/04-functions/cookies.md
grep -rl "revalidateTag" $D/01-app | head            # which pages discuss a symbol
grep -rn "Starting with Next.js 16" $D/01-app | head # what changed in this major
```

Prefer `03-api-reference/` when you need exact signatures and return types, and
`01-getting-started/` or `02-guides/` when you need the shape of a whole approach. Read the page
before writing the code — a diff that "looks like a one-liner" is exactly where a renamed API hides.

## Things this version does differently

These have already bitten this codebase, so they are worth knowing before you go looking:

- **`middleware.ts` is now `proxy.ts`.** Next.js 16 renamed Middleware to Proxy; the behaviour is the
  same, but the old filename and the `runtime` export no longer work — it defaults to the Node.js
  runtime and setting `runtime` throws. This repo's copy lives at `src/proxy.ts`. See
  `01-app/01-getting-started/16-proxy.md` and `01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Caching and `use cache`** changed shape in 16 (`cacheLife`, `cacheTag`, `updateTag`, cache
  components). Check `01-app/03-api-reference/01-directives/use-cache.md` and the `caching` /
  `revalidating` getting-started pages rather than assuming 13/14-era `fetch` cache semantics.
- **A Server Action is a directly POST-able endpoint.** The docs' authentication and data-security
  guides say this plainly, and it is why every action in `src/lib/**Actions.ts` re-checks
  authorization itself instead of relying on the page that rendered the form.
- **Turbopack is the dev bundler.** `FATAL: An unexpected Turbopack error` usually means stale build
  state, not broken source — `npm run clean` and restart. `08-turbopack.md` covers the rest.

## AGENTS.md

`AGENTS.md` at the repo root is generated and re-added by `next dev` (see
`node_modules/next/dist/server/lib/generate-agent-files.js`). Deleting it from a diff just recreates
the uncommitted change; commit it alongside your work to keep the tree clean.
