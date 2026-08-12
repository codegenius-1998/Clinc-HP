import { listUsers } from "@/lib/auth";
import { createUserAction, deleteUserAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { inputClass } from "@/components/admin/adminStyles";
import { ModalForm } from "@/components/admin/ModalForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

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
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader title="ユーザー管理" description="クリニックオーナーのアカウントを管理します（管理者アカウントはここには表示されません）。" />
        <ModalForm action={createUserAction} triggerLabel="＋ 新規ユーザー作成" title="新規ユーザー作成" submitLabel="作成">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">メールアドレス</label>
            <input name="email" type="email" required className={inputClass} placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">パスワード</label>
            <input name="password" type="password" required minLength={8} className={inputClass} placeholder="••••••••" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-slate-500">ロール</label>
            <select name="role" required defaultValue="clinic_owner" className={inputClass}>
              <option value="clinic_owner">clinic_owner</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </ModalForm>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
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
                  <ConfirmDeleteButton
                    action={deleteUserAction.bind(null, user.id)}
                    confirmText={`「${user.email}」を削除しますか？`}
                  />
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
