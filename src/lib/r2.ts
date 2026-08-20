import { S3Client } from "@aws-sdk/client-s3";

/** Client for Cloudflare R2 via its S3-compatible API — used instead of a Workers `R2Bucket` binding
 * for the same reason src/lib/d1.ts talks to D1 over HTTP: this app runs as a normal Node server, not
 * on Cloudflare Workers, so there is no binding to reach for. R2's own access keys (R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY, created under R2 → Manage API Tokens in the dashboard) are separate from the
 * general CLOUDFLARE_API_TOKEN used elsewhere in this app for D1 and Workers/Pages deploys. */

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export function getR2Client(): S3Client | null {
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/** Builds the public URL for an object under R2_PUBLIC_URL — either the bucket's r2.dev URL
 * (dashboard → bucket → Settings → Public Access) or a custom domain mapped to it. Returns null when
 * that isn't configured, since there is then no URL the browser could actually load the object from
 * (R2 objects are private by default; uploading alone doesn't make them reachable). */
export function r2PublicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}
