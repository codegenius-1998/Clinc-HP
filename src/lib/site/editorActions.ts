"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { renderSiteFiles, siteOutputPath } from "@/lib/render/renderSiteFiles";
import { deployGeneratedSiteToCloudflare } from "@/lib/cloudflareDeploy";
import { AccessDeniedError, requireEditableDocument } from "./access";
import { saveDocument } from "./store";
import { siteDocumentSchema, type SiteDocument } from "./document";

/** Server Actions behind the editor. Saving is deliberately AI-free: it validates, writes to D1 and
 * re-renders the static files. That is the whole reason editing text is instant and costs nothing,
 * while `generateSite` (which does call the models) stays a separate, explicit action. */

export type SaveState = {
  error: string | null;
  /** Echoed back so the editor can cache-bust its preview iframe with a value it didn't invent. */
  updatedAt: string | null;
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AccessDeniedError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

export async function saveDocumentAction(id: string, incoming: SiteDocument): Promise<SaveState> {
  try {
    const { document } = await requireEditableDocument(id);

    // Only the editable surface is taken from the client. Identity, ownership and the template link
    // are read back from the stored row, so a tampered payload can't move a site to another owner,
    // turn itself into a template, or overwrite a different document.
    const parsed = siteDocumentSchema.parse({
      ...incoming,
      id: document.id,
      slug: document.slug,
      isTemplate: document.isTemplate,
      canSell: document.canSell,
      templateId: document.templateId,
      ownerEmail: document.ownerEmail,
      createdAt: document.createdAt,
    });

    const saved = await saveDocument(parsed);
    await renderSiteFiles(saved);

    revalidatePath(saved.isTemplate ? `/admin/templates/${saved.id}` : `/sites/${saved.slug}`);
    return { error: null, updatedAt: saved.updatedAt };
  } catch (err) {
    return { error: errorMessage(err, "保存に失敗しました。"), updatedAt: null };
  }
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** Copies an uploaded image (already in Supabase Storage, see /api/uploads) into the site's own
 * output directory and returns the SITE-RELATIVE path to store in the block.
 *
 * The copy is not redundant: a generated site is deployed to Cloudflare Pages as a self-contained
 * directory, so an <img> pointing at a Supabase URL would make every published page depend on
 * Supabase staying reachable and on those objects staying public. */
export async function adoptImageAction(id: string, sourceUrl: string): Promise<{ path: string | null; error: string | null }> {
  try {
    const { document } = await requireEditableDocument(id);

    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:") {
      return { path: null, error: "画像のURLが正しくありません。" };
    }

    const response = await fetch(parsed, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      return { path: null, error: `画像を取得できませんでした（HTTP ${response.status}）。` };
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const extension = EXTENSION_BY_TYPE[contentType];
    if (!extension) {
      return { path: null, error: `対応していない画像形式です（${contentType || "不明"}）。` };
    }

    const relative = `images/${randomUUID().slice(0, 8)}.${extension}`;
    const { outDir } = siteOutputPath(document);
    await mkdir(path.join(outDir, "images"), { recursive: true });
    await writeFile(path.join(outDir, relative), Buffer.from(await response.arrayBuffer()));

    return { path: relative, error: null };
  } catch (err) {
    return { path: null, error: errorMessage(err, "画像の取り込みに失敗しました。") };
  }
}

/** Publishes the current rendered files to Cloudflare Pages. Templates are never publishable — they
 * are internal design assets, not a clinic's website. */
export async function publishDocumentAction(id: string): Promise<{ url: string | null; error: string | null }> {
  try {
    const { document } = await requireEditableDocument(id);
    if (document.isTemplate) {
      return { url: null, error: "テンプレートは公開できません。" };
    }
    await renderSiteFiles(document);
    const result = await deployGeneratedSiteToCloudflare(document.slug);
    return { url: result.url, error: null };
  } catch (err) {
    return { url: null, error: errorMessage(err, "公開に失敗しました。") };
  }
}
