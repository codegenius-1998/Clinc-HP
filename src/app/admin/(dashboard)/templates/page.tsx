import Link from "next/link";
import { listTemplates } from "@/lib/site/store";
import { deleteTemplateAction, setTemplateCanSellAction } from "@/lib/template/templateActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { IllustrateTemplateButton } from "@/components/admin/IllustrateTemplateButton";
import { readdir } from "fs/promises";
import path from "path";

/** Templates are SiteDocuments with is_template = 1 — the same shape as a generated clinic site, so
 * they render and edit through exactly the same code. `canSell` is the gate that decides whether the
 * auto-selector may hand a template to a real clinic (see selectTemplate.ts). */
/** True when the rendered template still has nothing but the placeholder in its images/ directory.
 *
 * ⚠️ Read from disk, not from the document. Answering this properly means walking the blocks, and
 * the list has only summaries — one D1 round trip per row, on every page load, to draw a badge. The
 * directory listing answers the question that actually matters here ("why is this preview grey?")
 * for the cost of a readdir. */
async function hasNoPhotos(templateId: string): Promise<boolean> {
  const dir = path.join(process.cwd(), "public", "generated", "_templates", templateId, "images");
  const files = await readdir(dir).catch(() => [] as string[]);
  return files.filter((file) => file !== "placeholder.svg").length === 0;
}

export default async function AdminTemplatesPage() {
  const templates = await listTemplates();
  const photoless = new Set(
    (await Promise.all(templates.map(async (t) => ((await hasNoPhotos(t.id)) ? t.id : null)))).filter(
      (id): id is string => id !== null
    )
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="テンプレート管理"
          description="サイト作成時にAIが自動で選ぶデザインテンプレートです。「販売可」にしたものだけが選択候補になります。"
        />
        <Link
          href="/admin/templates/new"
          className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700"
        >
          ＋ URLからテンプレートを作る
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/templates/${template.id}`}
                    className="text-[17px] font-medium text-slate-900 underline-offset-4 hover:underline"
                  >
                    {template.name}
                  </Link>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] ${
                      template.canSell ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {template.canSell ? "販売可（自動選択の候補）" : "非公開（候補に入らない）"}
                  </span>
                  {photoless.has(template.id) && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] text-amber-700 ring-1 ring-amber-200">
                      写真が未生成（プレビューは灰色の枠になります）
                    </span>
                  )}
                </div>
                {template.mood && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-500">{template.mood}</p>}
                {template.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[12px] text-slate-500 ring-1 ring-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {template.sourceUrl && (
                  <p className="mt-2 truncate text-[13px] text-slate-400">参考: {template.sourceUrl}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/generated/_templates/${template.id}/index.html`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-600 transition-colors hover:bg-slate-50"
                >
                  プレビュー
                </a>
                <IllustrateTemplateButton templateId={template.id} name={template.name} />
                <form action={setTemplateCanSellAction.bind(null, template.id, !template.canSell)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    {template.canSell ? "非公開にする" : "販売可にする"}
                  </button>
                </form>
                <ConfirmDeleteButton
                  action={deleteTemplateAction.bind(null, template.id)}
                  confirmText={`「${template.name}」を削除しますか？`}
                />
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-[15px] text-slate-400">
            テンプレートがまだありません。「＋ URLからテンプレートを作る」から作成してください。
            <br />
            テンプレートが1つも無い場合、サイト作成時は標準テンプレートが使われます。
          </p>
        )}
      </div>
    </div>
  );
}
