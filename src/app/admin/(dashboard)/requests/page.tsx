import Link from "next/link";
import { listHearings } from "@/lib/hearing";
import { deleteRequestAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { GenerateSiteButton } from "@/components/admin/GenerateSiteButton";

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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[36rem] text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">クリニック名</th>
              <th className="px-4 py-3 font-medium">申請者</th>
              <th className="px-4 py-3 font-medium">送信日時</th>
              <th className="px-4 py-3 font-medium">サイト</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hearings.map((hearing) => (
              <tr key={hearing.slug} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-900">{hearing.clinicName}</td>
                <td className="px-4 py-3 text-slate-500">{hearing.ownerEmail ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(hearing.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-1.5">
                    <GenerateSiteButton
                      slug={hearing.slug}
                      previewUrl={hearing.generatedSite ? `/api/generated/${hearing.slug}/` : undefined}
                    />
                    {hearing.generatedSite && (
                      <Link
                        href={`/admin/requests/${hearing.slug}/edit`}
                        className="text-[13px] text-slate-600 underline underline-offset-4 hover:text-slate-900"
                      >
                        編集
                      </Link>
                    )}
                  </div>
                </td>
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
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
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
