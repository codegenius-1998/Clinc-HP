import { listDepartments, listServices } from "@/lib/content";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  createServiceAction,
  deleteServiceAction,
} from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm, inputClass } from "@/components/admin/AdminForm";

export default async function AdminDepartmentsPage() {
  const [departments, services] = await Promise.all([listDepartments(), listServices()]);
  const servicesByDepartment = new Map<string, typeof services>();
  for (const service of services) {
    const list = servicesByDepartment.get(service.department_id) ?? [];
    list.push(service);
    servicesByDepartment.set(service.department_id, list);
  }

  return (
    <div>
      <AdminPageHeader title="部門管理" description="診療科（部門）と、それぞれのサービスを管理します。" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-[14px] font-medium text-slate-900">新規部門作成</h2>
        <AdminForm action={createDepartmentAction} submitLabel="作成" className="mt-4 flex items-end gap-3">
          <input name="name" required className={inputClass} placeholder="例: 内科" />
        </AdminForm>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {departments.map((department) => (
          <div key={department.id} className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-medium text-slate-900">{department.name}</h3>
              <form action={deleteDepartmentAction.bind(null, department.id)}>
                <button type="submit" className="text-[13px] text-slate-400 underline underline-offset-4 hover:text-red-600">
                  部門を削除
                </button>
              </form>
            </div>

            <ul className="mt-4 flex flex-col gap-1">
              {(servicesByDepartment.get(department.id) ?? []).map((service) => (
                <li key={service.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-slate-50">
                  <span className="text-slate-700">{service.name}</span>
                  <form action={deleteServiceAction.bind(null, service.id)}>
                    <button type="submit" className="text-slate-300 hover:text-red-600">
                      ×
                    </button>
                  </form>
                </li>
              ))}
              {(servicesByDepartment.get(department.id) ?? []).length === 0 && (
                <li className="px-2 py-1.5 text-[13px] text-slate-400">サービスがありません。</li>
              )}
            </ul>

            <AdminForm action={createServiceAction} submitLabel="サービスを追加" className="mt-3 flex items-end gap-2">
              <input type="hidden" name="departmentId" value={department.id} />
              <input name="name" required className={`${inputClass} flex-1`} placeholder="例: 一般内科診療" />
            </AdminForm>
          </div>
        ))}
        {departments.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-400">
            部門がまだありません。
          </p>
        )}
      </div>
    </div>
  );
}
