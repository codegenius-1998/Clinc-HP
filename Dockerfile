# Runs the app as an ordinary Node server inside a Cloudflare Container — chosen over a Workers/Pages
# rewrite specifically so the existing local-filesystem code (hearing.ts's JSON storage,
# renderSiteFiles.ts's generated-site output, cloudflareDeploy.ts's `wrangler` child_process calls)
# keeps working unmodified. See the container's own note in wrangler.jsonc about what that trades away:
# that filesystem is NOT persistent across container restarts/redeploys.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Real secrets are supplied at runtime (see wrangler.jsonc); the build itself needs no env vars since
# nothing here is statically generated against D1/Supabase/OpenAI at build time.
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# cloudflareDeploy.ts shells out to `npx wrangler pages deploy` (invoking it as a subprocess, not a JS
# import, so Next's standalone output tracer never bundles it). Installing it globally here means that
# feature runs instantly instead of `npx` fetching the wrangler package fresh on every cold container
# start — the container filesystem doesn't persist between them.
RUN npm install --global wrangler@4

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  # Runtime-written state (see the top-of-file note) — must exist and be writable by the non-root
  # user before USER switches below, since `mkdir -p` won't fix ownership after the fact.
  && mkdir -p /app/data/hearings /app/public/generated \
  && chown -R nextjs:nodejs /app/data /app/public

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
