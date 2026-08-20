import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** HTTP Basic auth in front of the whole app, for showing a locally-running instance to a client over
 * a tunnel (cloudflared, ngrok, …). It exists because several entry points here are deliberately
 * unauthenticated for local use — /create submits a hearing sheet, /sites lists every clinic,
 * /sites/[slug] can trigger AI generation and a Cloudflare Pages publish, and POST /api/uploads writes
 * to Supabase Storage. All of that is fine on localhost and none of it is fine on a public URL.
 *
 * Off by default: with PREVIEW_BASIC_AUTH unset (normal local development) every request passes
 * straight through, so this file changes nothing until a tunnel is actually being used.
 *
 * This is a gate on the *preview*, NOT a replacement for the app's own login — requireAdmin() and
 * requireEditableDocument() still decide who may do what once past it.
 *
 * Format: PREVIEW_BASIC_AUTH="user:password" (the password may itself contain ":"). */

const CREDENTIALS = process.env.PREVIEW_BASIC_AUTH?.trim();

/** Compares without leaking, through response timing, how many leading characters were correct.
 * timingSafeEqual throws on a length mismatch, hence the separate length check — that only reveals
 * the length of the expected value, which the realm prompt gives away anyway. */
function matches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function unauthorized(): NextResponse {
  return new NextResponse("認証が必要です。", {
    status: 401,
    headers: {
      // charset=UTF-8 so a non-ASCII password is transmitted as the browser encoded it.
      "WWW-Authenticate": 'Basic realm="Clinc-HP preview", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      // A preview URL has no business being indexed, and tunnel hostnames do get crawled.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function proxy(request: NextRequest): NextResponse {
  if (!CREDENTIALS) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return unauthorized();

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return unauthorized();
  }

  if (!matches(decoded, CREDENTIALS)) return unauthorized();

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Everything except Next's own immutable build assets. /generated/* (the rendered clinic sites) and
  // /api/* are intentionally INSIDE the gate — they are the two things most worth protecting.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
