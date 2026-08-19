import { lookup } from "dns/promises";
import { isIP } from "net";

/** Fetches a URL that an admin typed in. Everything here exists because the URL is attacker-influenced
 * in the general case (an admin can be socially engineered, and the same code path would be a hole if
 * this ever became self-serve): a naive `fetch(userUrl)` from the server would happily read
 * http://localhost:3000/api/..., cloud metadata endpoints on 169.254.169.254, or anything else on the
 * private network the browser could never reach.
 *
 * Guards, in order: scheme, hostname/IP range, redirect chain (each hop re-checked), response size,
 * and a wall-clock timeout. */

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

class UnsafeUrlError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique-local
  if (normalized.startsWith("fe80")) return true; // link-local
  // IPv4-mapped (::ffff:127.0.0.1) would otherwise slip past the v4 checks entirely.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not an IP literal we understand — refuse rather than guess
}

/** Throws unless `raw` is an http(s) URL that resolves to a publicly routable address. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URLの形式が正しくありません。");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("http:// または https:// のURLを指定してください。");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError(`このホストは取得できません（${url.hostname}）。外部に公開されているサイトのURLを指定してください。`);
  }

  // A hostname can resolve to a private address just as easily as being typed as one.
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`ホスト名を解決できませんでした（${url.hostname}）。`);
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new UnsafeUrlError(`このホストは取得できません（${url.hostname}）。社内・ローカルのアドレスは指定できません。`);
  }

  return url;
}

/** Reads at most `maxBytes` of the body, aborting the stream rather than buffering a huge response. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.byteLength;
      if (total >= maxBytes) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged.slice(0, maxBytes));
}

export type SafeFetchResult = { url: string; text: string; contentType: string };

/** Redirects are followed by hand (`redirect: "manual"`) so every hop gets the same host check — a
 * public URL that 302s to http://169.254.169.254 would otherwise sail straight through. */
export async function safeFetchText(raw: string, maxBytes: number): Promise<SafeFetchResult> {
  let current = raw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Some sites serve a stripped page to unknown agents; identify honestly but plausibly.
          "User-Agent": "Mozilla/5.0 (compatible; ClincHP-TemplateImporter/1.0)",
          Accept: "text/html,text/css,*/*;q=0.8",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`リダイレクト先が取得できませんでした（${url.href}）。`);
        current = new URL(location, url).href;
        continue;
      }
      if (!response.ok) {
        throw new Error(`ページを取得できませんでした（HTTP ${response.status}: ${url.href}）。`);
      }

      return {
        url: url.href,
        text: await readCapped(response, maxBytes),
        contentType: response.headers.get("content-type") ?? "",
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`ページの取得がタイムアウトしました（${url.href}）。`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("リダイレクトが多すぎます。");
}

export { UnsafeUrlError };
