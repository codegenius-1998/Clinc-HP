import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listHearingsByOwner, hearingStatus } from "@/lib/hearing";
import { deleteOwnApplicationAction } from "@/lib/applicationActions";
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

export default async function MypageRequestsPage() {
  const session = await getSession();
  const hearings = await listHearingsByOwner(session!.email);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader title="申請一覧" description="送信したホームページ作成の申請です。" />
        <Link
          href="/mypage/apply"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-[13px] font-medium text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500"
        >
          新規申請
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">クリニック名</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">申請日時</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hearings.map((hearing) => {
              const status = hearingStatus(hearing);
              return (
                <tr key={hearing.slug} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    {status.key === "generated" ? (
                      <Link href={`/sites/${hearing.slug}`} className="text-slate-900 underline-offset-4 hover:underline">
                        {hearing.clinicName}
                      </Link>
                    ) : (
                      <span className="text-slate-900">{hearing.clinicName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(hearing.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <ConfirmDeleteButton
                      action={deleteOwnApplicationAction.bind(null, hearing.slug)}
                      confirmText={`「${hearing.clinicName}」の申請を削除しますか？`}
                    />
                  </td>
                </tr>
              );
            })}
            {hearings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  申請はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
