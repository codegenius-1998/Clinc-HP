import { listSections } from "@/lib/content";
import { createSectionAction, updateSectionAction, deleteSectionAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { inputClass } from "@/components/admin/adminStyles";
import { ModalForm } from "@/components/admin/ModalForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function AdminSectionsPage() {
  const sections = await listSections();

  return (
    <div>
      <AdminPageHeader title="セクション管理" description="テンプレートに追加できるセクション種類を管理します。" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-[16px] font-medium text-slate-900">新規セクション作成</h2>
        <AdminForm action={createSectionAction} submitLabel="作成" className="mt-4 flex items-end gap-3">
          <input name="name" required className={`${inputClass} flex-1`} placeholder="例: 診療科案内" />
        </AdminForm>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">名前</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{section.name}</td>
                <td className="px-4 py-3 text-right">
                  <ModalForm
                    action={updateSectionAction}
                    triggerLabel="編集"
                    triggerClassName="mr-4 text-slate-400 underline underline-offset-4 hover:text-slate-900"
                    title="セクション名を編集"
                    submitLabel="保存"
                  >
                    <input type="hidden" name="id" value={section.id} />
                    <div className="flex flex-col gap-1">
                      <label className="text-[14px] text-slate-500">セクション名</label>
                      <input name="name" required defaultValue={section.name} className={inputClass} />
                    </div>
                  </ModalForm>
                  <ConfirmDeleteButton
                    action={deleteSectionAction.bind(null, section.id)}
                    confirmText={`「${section.name}」を削除しますか？`}
                  />
                </td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  セクションがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
