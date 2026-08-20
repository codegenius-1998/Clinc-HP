/** Client for Supabase Storage via its REST API — used instead of the @supabase/supabase-js SDK for
 * the same reason src/lib/d1.ts talks to D1 over HTTP: every backend in this app is reached with plain
 * fetch, so there is no client object to keep in sync and no extra dependency to carry.
 *
 * SUPABASE_SERVICE_ROLE_KEY is preferred when present because it bypasses the bucket's row-level
 * policies, which is what a server-side uploader wants. SUPABASE_ANON_KEY works too as long as the
 * bucket has an INSERT policy for the anon role — that is how this project's `site-images` bucket is
 * currently set up. Either key is only ever read here, on the server; neither reaches the browser. */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

/** Bucket holding every user-uploaded and AI-generated photo. Must be marked Public in the Supabase
 * dashboard (Storage → bucket → Settings), otherwise publicUrl() below points at nothing the browser
 * can load — objects are private by default and uploading alone does not make them reachable. */
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "site-images";

export function isStorageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** Public URL of an object, in the same shape as the URLs already stored in existing hearing sheets:
 * <project>/storage/v1/object/public/<bucket>/<key>. Returns null when Supabase isn't configured. */
export function publicUrl(key: string): string | null {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${key}`;
}

export class StorageError extends Error {}

/** Uploads one object and returns its public URL. Throws StorageError with Supabase's own message so
 * the caller can surface something more useful than "アップロードに失敗しました". */
export async function uploadObject(key: string, body: ArrayBuffer, contentType: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new StorageError("Supabase Storageが設定されていません（SUPABASE_URL / SUPABASE_ANON_KEY）。");
  }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": contentType,
      // Keys carry a fresh UUID, so a collision means a retry of the same upload rather than a
      // different file — overwriting is the harmless outcome.
      "x-upsert": "true",
    },
    body,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let message = detail;
    try {
      const parsed = JSON.parse(detail) as { message?: string; error?: string };
      message = parsed.message || parsed.error || detail;
    } catch {
      // not JSON — keep the raw body
    }
    throw new StorageError(`Supabase Storage HTTP ${response.status}: ${message || "不明なエラー"}`);
  }

  const url = publicUrl(key);
  if (!url) throw new StorageError("Supabase StorageのURLを組み立てられませんでした。");
  return url;
}
