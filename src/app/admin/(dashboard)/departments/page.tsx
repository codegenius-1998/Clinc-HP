import Link from "next/link";
import { listDepartments, listServices } from "@/lib/content";
import { createDepartmentAction, updateDepartmentAction, deleteDepartmentAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ModalForm } from "@/components/admin/ModalForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { RepeatableTextInputs } from "@/components/admin/RepeatableTextInputs";
import { inputClass } from "@/components/admin/adminStyles";

export default async function AdminDepartmentsPage() {
  const [departments, services] = await Promise.all([listDepartments(), listServices()]);
  const serviceCountByDepartment = new Map<string, number>();
  for (const service of services) {
    serviceCountByDepartment.set(service.department_id, (serviceCountByDepartment.get(service.department_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader title="部門管理" description="診療科（部門）を管理します。部門名を押すとサービスの詳細画面に移動します。" />
        <ModalForm action={createDepartmentAction} triggerLabel="＋ 新規部門作成" title="新規部門作成" submitLabel="作成">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">部門名</label>
            <input name="name" required className={inputClass} placeholder="例: 内科" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">サービス（任意）</label>
            <RepeatableTextInputs name="serviceName" placeholder="例: 一般内科診療" />
          </div>
        </ModalForm>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">部門名</th>
              <th className="px-4 py-3 font-medium">サービス数</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/departments/${department.id}`} className="text-slate-900 underline-offset-4 hover:underline">
                    {department.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{serviceCountByDepartment.get(department.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <ModalForm
                    action={updateDepartmentAction}
                    triggerLabel="編集"
                    triggerClassName="mr-4 text-slate-400 underline underline-offset-4 hover:text-slate-900"
                    title="部門名を編集"
                    submitLabel="保存"
                  >
                    <input type="hidden" name="id" value={department.id} />
                    <div className="flex flex-col gap-1">
                      <label className="text-[14px] text-slate-500">部門名</label>
                      <input name="name" required defaultValue={department.name} className={inputClass} />
                    </div>
                  </ModalForm>
                  <ConfirmDeleteButton
                    action={deleteDepartmentAction.bind(null, department.id)}
                    confirmText={`「${department.name}」を削除しますか？所属するサービスも全て削除されます。`}
                  />
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  部門がまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
