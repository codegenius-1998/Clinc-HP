"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteDocument, getDocument, saveDocument } from "@/lib/site/store";
import { importTemplateFromUrl } from "./importFromUrl";
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

  const url = typeof formData.get("url") === "string" ? (formData.get("url") as string).trim() : "";
  const imageUrls = splitUrls(formData.get("imageUrls"));
  const name = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";

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
