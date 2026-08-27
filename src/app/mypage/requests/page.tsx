import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listHearingsByOwner } from "@/lib/hearing";
import { deleteOwnApplicationAction } from "@/lib/applicationActions";
import { MypagePageHeader } from "@/components/mypage/MypageShell";
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
  if (session?.role !== "clinic_owner") {
    redirect("/login");
  }
  const hearings = await listHearingsByOwner(session.email);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <MypagePageHeader title="申請一覧" description="送信したホームページ作成の申請です。" />
        <Link
          href="/mypage/apply"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-[13px] font-medium text-paper transition-transform hover:-translate-y-0.5 hover:bg-brand-deep"
        >
          新規申請
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="overflow-hidden border border-line bg-paper">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-line bg-canvas text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">クリニック名</th>
              <th className="px-4 py-3 font-medium">申請日時</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hearings.map((hearing) => (
              <tr key={hearing.slug} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-ink">{hearing.clinicName}</td>
                <td className="px-4 py-3 text-ink-soft/75">{formatDate(hearing.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmDeleteButton
                    action={deleteOwnApplicationAction.bind(null, hearing.slug)}
                    confirmText={`「${hearing.clinicName}」の申請を削除しますか？`}
                  />
                </td>
              </tr>
            ))}
            {hearings.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-soft/75">
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
