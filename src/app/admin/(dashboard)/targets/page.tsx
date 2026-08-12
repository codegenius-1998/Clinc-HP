import { listTargets } from "@/lib/content";
import { createTargetAction, deleteTargetAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { inputClass } from "@/components/admin/adminStyles";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function AdminTargetsPage() {
  const targets = await listTargets();

  return (
    <div>
      <AdminPageHeader title="ターゲット管理" description="想定する患者層タグ（例: ファミリー、高齢者）を管理します。" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-[16px] font-medium text-slate-900">新規ターゲット作成</h2>
        <AdminForm action={createTargetAction} submitLabel="作成" className="mt-4 flex items-end gap-3">
          <input name="name" required className={`${inputClass} flex-1`} placeholder="例: ファミリー層" />
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
            {targets.map((target) => (
              <tr key={target.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{target.name}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmDeleteButton
                    action={deleteTargetAction.bind(null, target.id)}
                    confirmText={`「${target.name}」を削除しますか？`}
                  />
                </td>
              </tr>
            ))}
            {targets.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  ターゲットがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
