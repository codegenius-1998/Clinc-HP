import Link from "next/link";
import { listSites } from "@/lib/content";
import { createSiteAction, deleteSiteAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { inputClass } from "@/components/admin/adminStyles";
import { ModalForm } from "@/components/admin/ModalForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function AdminTemplatesPage() {
  const templates = await listSites({ isTemplate: true });

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader title="テンプレート管理" description="サイトテンプレートを管理します。セクションの種類は「セクション管理」で管理します。" />
        <ModalForm action={createSiteAction} triggerLabel="＋ 新規テンプレート作成" title="新規テンプレート作成" submitLabel="作成">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">テンプレート名</label>
            <input name="name" required className={inputClass} placeholder="例: クリニック標準型" />
          </div>
          <label className="flex items-center gap-2 text-[15px] text-slate-600">
            <input name="canSell" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            販売可能にする
          </label>
        </ModalForm>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
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
                  <ConfirmDeleteButton
                    action={deleteSiteAction.bind(null, site.id)}
                    confirmText={`「${site.name}」を削除しますか？`}
                  />
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
  );
}
