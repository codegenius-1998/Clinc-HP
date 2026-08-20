import { Container, getContainer } from "@cloudflare/containers";
import type { DurableObject } from "cloudflare:workers";

/** Front door for the app on Cloudflare. This Worker does almost nothing itself — it just starts (or
 * finds) the one running container instance and forwards every request to it. All real request
 * handling stays in the Next.js app (see Dockerfile), which is what lets the rest of this codebase
 * (Server Actions, D1 access, local-filesystem writes for hearings/generated sites) run completely
 * unmodified instead of being rewritten against the Workers runtime. */

export type Env = {
  CLINC_HP_CONTAINER: DurableObjectNamespace<ClincHpContainer>;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_D1_DATABASE_ID: string;
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** Optional: set only if the site-images bucket's policies do not let the anon role INSERT. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Optional: defaults to "site-images" (see src/lib/supabaseStorage.ts). */
  SUPABASE_STORAGE_BUCKET?: string;
};

export class ClincHpContainer extends Container<Env> {
  defaultPort = 8080;
  // A single always-on instance (see max_instances: 1 in wrangler.jsonc) — data/hearings and
  // public/generated live on this container's own disk (see Dockerfile), so a second instance would
  // have its own, different copy of that state rather than sharing it. Sleeping would also mean losing
  // that disk on every wake, which defeats the point of writing to it at all. Revisit only once that
  // state has actually moved to D1/Supabase Storage (see the Dockerfile's top-of-file note).
  sleepAfter = "24h";

  constructor(ctx: DurableObject["ctx"], env: Env) {
    super(ctx, env);
    // The app reads these via process.env (see src/lib/d1.ts, src/lib/supabaseStorage.ts, cloudflareDeploy.ts, the
    // OpenAI client) exactly as it does in local dev — only the source changed, from .env.local to
    // secrets set with `wrangler secret put <NAME>` (see the deploy notes in wrangler.jsonc).
    const vars: Record<string, string | undefined> = {
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_D1_DATABASE_ID: env.CLOUDFLARE_D1_DATABASE_ID,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_STORAGE_BUCKET: env.SUPABASE_STORAGE_BUCKET,
    };
    // The two optional secrets above are simply absent when never `wrangler secret put`-ed; passing
    // them through as undefined would make process.env hold the literal string "undefined".
    this.envVars = Object.fromEntries(Object.entries(vars).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    // No per-user routing key: this is deliberately one shared instance (see sleepAfter's comment
    // above), so every request goes to the same container regardless of who's asking.
    const container = getContainer(env.CLINC_HP_CONTAINER);
    return container.fetch(request);
  },
};

export default worker;
