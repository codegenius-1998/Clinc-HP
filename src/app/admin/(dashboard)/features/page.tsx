import { listFeatures } from "@/lib/content";
import { createFeatureAction, updateFeatureAction, deleteFeatureAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { inputClass } from "@/components/admin/adminStyles";
import { ModalForm } from "@/components/admin/ModalForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function AdminFeaturesPage() {
  const features = await listFeatures();

  return (
    <div>
      <AdminPageHeader title="特徴管理" description="医院の特徴タグ（例: 駅近、キッズスペースあり）を管理します。" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-[16px] font-medium text-slate-900">新規特徴作成</h2>
        <AdminForm action={createFeatureAction} submitLabel="作成" className="mt-4 flex items-end gap-3">
          <input name="name" required className={`${inputClass} flex-1`} placeholder="例: 駅から徒歩5分" />
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
            {features.map((feature) => (
              <tr key={feature.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{feature.name}</td>
                <td className="px-4 py-3 text-right">
                  <ModalForm
                    action={updateFeatureAction}
                    triggerLabel="編集"
                    triggerClassName="mr-4 text-slate-400 underline underline-offset-4 hover:text-slate-900"
                    title="特徴名を編集"
                    submitLabel="保存"
                  >
                    <input type="hidden" name="id" value={feature.id} />
                    <div className="flex flex-col gap-1">
                      <label className="text-[14px] text-slate-500">特徴名</label>
                      <input name="name" required defaultValue={feature.name} className={inputClass} />
                    </div>
                  </ModalForm>
                  <ConfirmDeleteButton
                    action={deleteFeatureAction.bind(null, feature.id)}
                    confirmText={`「${feature.name}」を削除しますか？`}
                  />
                </td>
              </tr>
            ))}
            {features.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  特徴がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
