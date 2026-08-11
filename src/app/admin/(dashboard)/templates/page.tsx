import Link from "next/link";
import { listSites, listSections } from "@/lib/content";
import { createSiteAction, deleteSiteAction, createSectionAction, deleteSectionAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm, inputClass } from "@/components/admin/AdminForm";

export default async function AdminTemplatesPage() {
  const [templates, sections] = await Promise.all([listSites({ isTemplate: true }), listSections()]);

  return (
    <div>
      <AdminPageHeader title="テンプレート管理" description="サイトテンプレートと、それを構成するセクションを管理します。" />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-[14px] font-medium text-slate-900">新規テンプレート作成</h2>
            <AdminForm action={createSiteAction} submitLabel="作成" className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-slate-500">テンプレート名</label>
                <input name="name" required className={inputClass} placeholder="例: クリニック標準型" />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-[13px] text-slate-600">
                <input name="canSell" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                販売可能にする
              </label>
            </AdminForm>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">名前</th>
                  <th className="px-4 py-3 font-medium">販売可否</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((site) => (
                  <tr key={site.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/templates/${site.id}`} className="text-slate-900 underline-offset-4 hover:underline">
                        {site.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{site.can_sell ? "販売可" : "非公開"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteSiteAction.bind(null, site.id)}>
                        <button type="submit" className="text-slate-400 underline underline-offset-4 hover:text-red-600">
                          削除
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      テンプレートがありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-[14px] font-medium text-slate-900">セクション</h2>
            <p className="mt-1 text-[12px] text-slate-400">テンプレートに追加できるセクション種類の一覧です。</p>
            <AdminForm action={createSectionAction} submitLabel="追加" className="mt-4 flex items-end gap-2">
              <input name="name" required className={`${inputClass} flex-1`} placeholder="例: 診療科案内" />
            </AdminForm>
            <ul className="mt-4 flex flex-col gap-1">
              {sections.map((section) => (
                <li key={section.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-slate-50">
                  <span className="text-slate-700">{section.name}</span>
                  <form action={deleteSectionAction.bind(null, section.id)}>
                    <button type="submit" className="text-slate-300 hover:text-red-600">
                      ×
                    </button>
                  </form>
                </li>
              ))}
              {sections.length === 0 && <li className="px-2 py-1.5 text-[13px] text-slate-400">セクションがありません。</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
