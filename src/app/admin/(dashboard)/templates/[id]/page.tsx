import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite, listSiteSections, listSections } from "@/lib/content";
import { addSiteSectionAction, deleteSiteSectionAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { inputClass } from "@/components/admin/adminStyles";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function AdminTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSite(id);
  if (!site) notFound();

  const [siteSections, sections] = await Promise.all([listSiteSections(id), listSections()]);

  return (
    <div>
      <Link href="/admin/templates" className="text-[15px] text-slate-400 hover:text-slate-900">
        ← テンプレート管理へ戻る
      </Link>
      <AdminPageHeader title={site.name} description="このテンプレートを構成するセクションと、そのcontent（JSON）を管理します。" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-[16px] font-medium text-slate-900">セクションを追加</h2>
        <AdminForm action={addSiteSectionAction} submitLabel="追加" className="mt-4 flex flex-wrap items-start gap-3">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">セクション</label>
            <select name="secId" required className={inputClass}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">表示順</label>
            <input name="position" type="number" defaultValue={siteSections.length} className={`${inputClass} w-20`} />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[14px] text-slate-500">content (JSON)</label>
            <textarea name="content" rows={2} defaultValue="{}" className={`${inputClass} min-w-[240px] font-mono`} />
          </div>
        </AdminForm>
        {sections.length === 0 && (
          <p className="mt-2 text-[14px] text-amber-600">
            先に「セクション管理」画面でセクションを作成してください。
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {siteSections.map((ss) => (
          <div key={ss.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-medium text-slate-900">
                #{ss.position} {ss.section_name}
              </p>
              <ConfirmDeleteButton
                action={deleteSiteSectionAction.bind(null, ss.id, site.id)}
                confirmText={`「${ss.section_name}」セクションを削除しますか？`}
                className="text-[15px] text-slate-400 underline underline-offset-4 hover:text-red-600"
              />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[14px] text-slate-600">{ss.content}</pre>
          </div>
        ))}
        {siteSections.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[15px] text-slate-400">
            まだセクションが追加されていません。
          </p>
        )}
      </div>
    </div>
  );
}
