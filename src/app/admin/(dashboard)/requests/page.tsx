import Link from "next/link";
import { listHearings, hearingStatus } from "@/lib/hearing";
import { DesignCheckBadge } from "@/components/sites/DesignCheckBadge";
import { deleteRequestAction, approveRequestAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { PendingForm } from "@/components/sites/PendingForm";
import { AutoRefresh } from "@/components/sites/AutoRefresh";

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
  const building = hearings.some((h) => hearingStatus(h).key === "generating");

  return (
    <div>
      {building && <AutoRefresh />}
      <AdminPageHeader title="リクエスト管理" description="クリニックオーナーから送信されたホームページ作成申請の一覧です。「承認待ち」の申請で「作成」を押すと、内容に合うテンプレートをAIが自動で選んでサイトを作ります。" />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">クリニック名</th>
              <th className="px-4 py-3 font-medium">テンプレート</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">送信日時</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hearings.map((hearing) => {
              const status = hearingStatus(hearing);
              return (
                <tr key={hearing.slug} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-slate-900">{hearing.clinicName}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {hearing.templateLabel ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      {status.key === "generated" && <DesignCheckBadge check={hearing.designCheck} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(hearing.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/sites/${hearing.slug}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
                      >
                        詳細を確認
                      </Link>
                      {(status.key === "pending_template" || status.key === "failed") && (
                        <PendingForm
                          action={approveRequestAction.bind(null, hearing.slug)}
                          label="作成"
                          pendingLabel="作成中…（数分）"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-sky-500 disabled:opacity-60"
                        />
                      )}
                      {status.key === "generated" && (
                        <Link
                          href={`/sites/${hearing.slug}/edit`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          編集
                        </Link>
                      )}
                      <ConfirmDeleteButton
                        action={deleteRequestAction.bind(null, hearing.slug)}
                        confirmText={`「${hearing.clinicName}」のリクエストを削除しますか？`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
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
