import { listUsers } from "@/lib/auth";
import { createUserAction, deleteUserAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminForm, inputClass } from "@/components/admin/AdminForm";

function formatDate(iso: string): string {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminUsersPage() {
  const users = await listUsers();

  return (
    <div>
      <AdminPageHeader title="ユーザー管理" description="管理者・クリニックオーナーのアカウントを管理します。" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-[14px] font-medium text-slate-900">新規ユーザー作成</h2>
        <AdminForm action={createUserAction} submitLabel="作成" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-slate-500">メールアドレス</label>
            <input name="email" type="email" required className={inputClass} placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-slate-500">パスワード</label>
            <input name="password" type="password" required minLength={8} className={inputClass} placeholder="••••••••" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-slate-500">ロール</label>
            <select name="role" required defaultValue="clinic_owner" className={inputClass}>
              <option value="clinic_owner">clinic_owner</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </AdminForm>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">メールアドレス</th>
              <th className="px-4 py-3 font-medium">ロール</th>
              <th className="px-4 py-3 font-medium">作成日時</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{user.email}</td>
                <td className="px-4 py-3 text-slate-500">{user.role}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteUserAction.bind(null, user.id)}>
                    <button type="submit" className="text-slate-400 underline underline-offset-4 hover:text-red-600">
                      削除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  ユーザーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
