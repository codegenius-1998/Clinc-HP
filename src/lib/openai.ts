/** Minimal OpenAI REST client — plain fetch, no SDK, for the same reason src/lib/d1.ts and
 * src/lib/supabaseStorage.ts talk to their backends over HTTP: this app runs as a normal Node
 * server and every backend is reached the same way.
 *
 * Only used server-side, from the site generator (src/lib/buildSiteFromHearing.ts). The key is read
 * here and nowhere else; it never reaches the browser. */

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL?.replace(/\/$/, "") || "https://api.openai.com/v1";
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export function isOpenAiConfigured(): boolean {
  return Boolean(API_KEY);
}

export class OpenAiError extends Error {}

function requireKey(): string {
  if (!API_KEY) {
    throw new OpenAiError("OpenAIが設定されていません（.env.local の OPENAI_API_KEY を確認してください）。");
  }
  return API_KEY;
}

async function readError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string } };
    return parsed.error?.message || detail || "不明なエラー";
  } catch {
    return detail || "不明なエラー";
  }
}

/** One chat completion constrained to a JSON object, parsed and returned. `T` is trusted only as
 * far as the caller's own normalisation — treat the result as unknown-shaped. */
export async function openaiJSON<T>(params: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const key = requireKey();
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    throw new OpenAiError(`OpenAI（テキスト生成）HTTP ${response.status}: ${await readError(response)}`);
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new OpenAiError("OpenAIからの応答が空でした（テキスト生成）。");

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new OpenAiError("OpenAIの応答をJSONとして解釈できませんでした。");
  }
}

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

/** One generated image, returned as PNG bytes (gpt-image-1 always responds with base64). */
export async function openaiImage(params: {
  prompt: string;
  size?: ImageSize;
}): Promise<ArrayBuffer> {
  const key = requireKey();
  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      size: params.size ?? "1024x1024",
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new OpenAiError(`OpenAI（画像生成）HTTP ${response.status}: ${await readError(response)}`);
  }

  const body = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const b64 = body.data?.[0]?.b64_json;
  if (b64) {
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  // Some deployments return a URL instead of inline base64 — follow it once.
  const url = body.data?.[0]?.url;
  if (url) {
    const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new OpenAiError(`生成画像の取得に失敗しました（HTTP ${img.status}）。`);
    return img.arrayBuffer();
  }
  throw new OpenAiError("OpenAIからの応答に画像が含まれていませんでした。");
}
