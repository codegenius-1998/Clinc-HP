"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteDocument, getDocument, saveDocument } from "@/lib/site/store";
import { importTemplateFromUrl } from "./importFromUrl";
import { importTemplateFromGeneratedSite } from "./importFromGeneratedSite";
import { UnsafeUrlError } from "./safeFetch";

/** Server Actions for the template library. Every one starts with `requireAdmin()` — a Server Action
 * is a directly POST-able endpoint, so gating the admin layout alone would leave these wide open. */

export type ImportResult = {
  id: string;
  name: string;
  previewUrl: string;
  mood: string;
  tags: string[];
  warnings: string[];
};

export type ImportState = { error: string | null; result: ImportResult | null };

/** Reads one field from a form submitted to a `useActionState` action.
 *
 * The fallback is not defensive noise: when a form is submitted BEFORE React has hydrated, React
 * falls back to a plain browser POST and encodes the action's arguments positionally — the FormData
 * argument's own fields arrive as `_1_<name>` (argument index 1; index 0 is the previous state).
 * Reading only the bare name makes every such submit look like an empty form, which is exactly the
 * "URLを入力してください" error reported against a form that clearly had a URL in it. */
function readField(formData: FormData, name: string): string {
  const value = formData.get(name) ?? formData.get(`_1_${name}`);
  return typeof value === "string" ? value.trim() : "";
}

function splitUrls(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\s,]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);
}

export async function importTemplateAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAdmin();

  const url = readField(formData, "url");
  const imageUrls = splitUrls(formData.get("imageUrls") ?? formData.get("_1_imageUrls"));
  const name = readField(formData, "name");

  if (!url && imageUrls.length === 0) {
    return { error: "参考サイトのURLか、参考画像のURLのどちらかを入力してください。", result: null };
  }

  try {
    const { document, previewUrl, warnings } = await importTemplateFromUrl({
      url: url || undefined,
      imageUrls,
      name: name || undefined,
    });

    revalidatePath("/admin/templates");
    return {
      error: null,
      result: {
        id: document.id,
        name: document.name,
        previewUrl,
        mood: document.mood ?? "",
        tags: document.tags,
        warnings,
      },
    };
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return { error: err.message, result: null };
    }
    return {
      error: err instanceof Error ? err.message : "テンプレートの作成に失敗しました。",
      result: null,
    };
  }
}

/** Turns a site this system already generated into a template. Kept separate from the URL importer
 * because nothing needs guessing here: a generated page states its own design tokens inline, so the
 * result reproduces the source exactly rather than approximating it. */
export async function importFromGeneratedSiteAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAdmin();

  const slug = readField(formData, "slug");
  const name = readField(formData, "name");
  if (!slug) {
    return { error: "テンプレート化する生成済みサイトを選んでください。", result: null };
  }

  try {
    const { document, previewUrl } = await importTemplateFromGeneratedSite(slug, name || undefined);
    revalidatePath("/admin/templates");
    return {
      error: null,
      result: {
        id: document.id,
        name: document.name,
        previewUrl,
        mood: document.mood ?? "",
        tags: document.tags,
        warnings: [],
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "テンプレートの作成に失敗しました。", result: null };
  }
}

/** Flips a template between "still being worked on" and "offered to the auto-selector". A template
 * with can_sell = 0 is invisible to selectTemplate, which is what keeps a half-finished import from
 * reaching a real clinic. */
export async function setTemplateCanSellAction(id: string, canSell: boolean): Promise<void> {
  await requireAdmin();
  const document = await getDocument(id);
  if (!document) return;
  await saveDocument({ ...document, canSell });
  revalidatePath("/admin/templates");
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteDocument(id);
  revalidatePath("/admin/templates");
}
