import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";

/** Serves the static clinic-site bundles written by src/lib/buildSiteFromHearing.ts to
 * public/_generated/<slug>/. A route handler rather than plain public/ hosting because those files
 * are created at runtime, after the build, and `next start` only serves public/ files that existed
 * at build time.
 *
 * Behind the app login (any signed-in user) and, in tunnel demos, behind src/proxy.ts Basic auth. */

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "public", "_generated");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("認証が必要です。", { status: 401 });
  }

  const { slug, path: parts = [] } = await ctx.params;

  // slug and every path segment: no separators, no dot-dot — defeats traversal out of ROOT.
  const segments = [slug, ...parts];
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))) {
    return new Response("不正なパスです。", { status: 400 });
  }

  const rel = parts.length ? parts.join("/") : "index.html";
  const filePath = path.join(ROOT, slug, rel);
  if (!filePath.startsWith(path.join(ROOT, slug) + path.sep) && filePath !== path.join(ROOT, slug, "index.html")) {
    return new Response("不正なパスです。", { status: 400 });
  }

  let body: Buffer;
  try {
    body = await readFile(filePath);
  } catch {
    return new Response("見つかりません。まだサイトが生成されていない可能性があります。", { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();

  // The bundle uses relative asset URLs (css/…, assets/…) so it stays portable for hand-off. When
  // served here the document URL may or may not carry a trailing slash (Next normalises it), which
  // would otherwise make `css/base.css` resolve against the wrong directory. A <base> pinned to the
  // bundle root makes every relative URL resolve correctly regardless.
  if (ext === ".html") {
    const html = body
      .toString("utf8")
      .replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<base href="/api/generated/${slug}/">`);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
