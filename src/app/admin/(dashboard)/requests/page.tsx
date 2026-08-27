import { listHearings } from "@/lib/hearing";
import { deleteRequestAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminRequestsPage() {
  const hearings = await listHearings();

  return (
    <div>
      <AdminPageHeader
        title="リクエスト管理"
        description="クリニックオーナーから送信されたホームページ作成申請の一覧です。"
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">クリニック名</th>
              <th className="px-4 py-3 font-medium">申請者</th>
              <th className="px-4 py-3 font-medium">送信日時</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hearings.map((hearing) => (
              <tr key={hearing.slug} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{hearing.clinicName}</td>
                <td className="px-4 py-3 text-slate-500">{hearing.ownerEmail ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(hearing.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmDeleteButton
                    action={deleteRequestAction.bind(null, hearing.slug)}
                    confirmText={`「${hearing.clinicName}」のリクエストを削除しますか？`}
                  />
                </td>
              </tr>
            ))}
            {hearings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  リクエストはまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
