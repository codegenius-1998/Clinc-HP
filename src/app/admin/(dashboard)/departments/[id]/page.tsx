import Link from "next/link";
import { notFound } from "next/navigation";
import { getDepartment, listServices } from "@/lib/content";
import { createServiceAction, updateServiceAction, deleteServiceAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ModalForm } from "@/components/admin/ModalForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { inputClass } from "@/components/admin/adminStyles";

export default async function AdminDepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const department = await getDepartment(id);
  if (!department) notFound();

  const services = await listServices(id);

  return (
    <div>
      <Link href="/admin/departments" className="text-[15px] text-slate-400 hover:text-slate-900">
        ← 部門管理へ戻る
      </Link>

      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader title={department.name} description="この部門のサービスを管理します。" />
        <ModalForm action={createServiceAction} triggerLabel="＋ サービス追加" title="サービスを追加" submitLabel="追加">
          <input type="hidden" name="departmentId" value={department.id} />
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">サービス名</label>
            <input name="name" required className={inputClass} placeholder="例: 一般内科診療" />
          </div>
        </ModalForm>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">サービス名</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{service.name}</td>
                <td className="px-4 py-3 text-right">
                  <ModalForm
                    action={updateServiceAction}
                    triggerLabel="編集"
                    triggerClassName="mr-4 text-slate-400 underline underline-offset-4 hover:text-slate-900"
                    title="サービス名を編集"
                    submitLabel="保存"
                  >
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="departmentId" value={department.id} />
                    <div className="flex flex-col gap-1">
                      <label className="text-[14px] text-slate-500">サービス名</label>
                      <input name="name" required defaultValue={service.name} className={inputClass} />
                    </div>
                  </ModalForm>
                  <ConfirmDeleteButton
                    action={deleteServiceAction.bind(null, service.id, department.id)}
                    confirmText={`「${service.name}」を削除しますか？`}
                  />
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  サービスがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
