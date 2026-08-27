"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isArchetypeKey } from "@/lib/site/archetypes";
import { deleteDocument, getDocument, saveDocument } from "@/lib/site/store";
import { importTemplateFromUrl } from "./importFromUrl";
import { importTemplateFromGeneratedSite } from "./importFromGeneratedSite";
import { UnsafeUrlError } from "./safeFetch";
import { illustrateTemplate, isIllustrating, planIllustration } from "./illustrateTemplate";

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
  const archetype = readField(formData, "archetype");

  if (!url && imageUrls.length === 0) {
    return { error: "参考サイトのURLか、参考画像のURLのどちらかを入力してください。", result: null };
  }

  try {
    const { document, previewUrl, warnings } = await importTemplateFromUrl({
      url: url || undefined,
      imageUrls,
      name: name || undefined,
      // Validated inside the importer against the registry — a tampered form field falls back to
      // the standard layout rather than being trusted or rejected.
      archetype: isArchetypeKey(archetype) ? archetype : undefined,
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
  const archetype = readField(formData, "archetype");
  if (!slug) {
    return { error: "テンプレート化する生成済みサイトを選んでください。", result: null };
  }

  try {
    const { document, previewUrl } = await importTemplateFromGeneratedSite(
      slug,
      name || undefined,
      isArchetypeKey(archetype) ? archetype : undefined
    );
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

/** How many pictures this template is still missing, and how many places it has for one.
 *
 * ⚠️ Deliberately its own action rather than something the list page computes. The list renders from
 * `DocumentSummary`, which carries no blocks; counting slots for every row would mean a full
 * `getDocument` each — and d1.ts sends one statement per round trip. This loads exactly the one
 * template the admin is asking about, when they ask. */
export async function countTemplateImagesAction(id: string): Promise<{ total: number; remaining: number }> {
  await requireAdmin();
  const document = await getDocument(id);
  if (!document) return { total: 0, remaining: 0 };
  const plan = await planIllustration(document);
  return { total: plan.length, remaining: plan.filter((item) => !item.onDisk).length };
}

/** Starts filling in the rest of a template's photographs.
 *
 * ⚠️ Starts, and does not wait. Fifteen images take minutes and Cloudflare cuts any origin response
 * at 100 seconds — the same constraint that made site generation fire-and-forget
 * (`void runGeneration` in contentActions.ts). The button polls `templateImageStatusAction`.
 *
 * ⚠️ This one spends money, so it is only ever reached by an explicit click; nothing calls it on
 * render. The double-click guard is inside illustrateTemplate. */
export async function illustrateTemplateAction(id: string): Promise<{ started: boolean }> {
  await requireAdmin();
  const document = await getDocument(id);
  if (!document || isIllustrating(id)) return { started: false };

  void illustrateTemplate(document).then(
    () => revalidatePath("/admin/templates"),
    (err) => console.warn("[templateActions] テンプレートの写真生成に失敗しました。", err)
  );
  return { started: true };
}

export async function templateImageStatusAction(id: string): Promise<{ running: boolean; remaining: number }> {
  await requireAdmin();
  const running = isIllustrating(id);
  const document = await getDocument(id);
  if (!document) return { running, remaining: 0 };
  return { running, remaining: (await planIllustration(document)).filter((item) => !item.onDisk).length };
}
