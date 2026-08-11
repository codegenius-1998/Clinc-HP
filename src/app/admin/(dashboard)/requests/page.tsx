import Link from "next/link";
import { listHearings } from "@/lib/hearing";
import { deleteRequestAction } from "@/lib/contentActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusOf(hearing: { previewUrl?: string; generationError?: string }): { label: string; className: string } {
  if (hearing.generationError) return { label: "生成失敗", className: "bg-red-50 text-red-700" };
  if (hearing.previewUrl) return { label: "生成済み", className: "bg-emerald-50 text-emerald-700" };
  return { label: "未生成", className: "bg-slate-100 text-slate-500" };
}

export default async function AdminRequestsPage() {
  const hearings = await listHearings();

  return (
    <div>
      <AdminPageHeader title="リクエスト管理" description="クリニックオーナーから送信されたホームページ作成リクエスト（ヒアリングシート）の一覧です。" />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-[13px]">
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
              const status = statusOf(hearing);
              return (
                <tr key={hearing.slug} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/sites/${hearing.slug}`} className="text-slate-900 underline-offset-4 hover:underline">
                      {hearing.clinicName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {hearing.templateLabel} ・ {hearing.colorSchemeLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(hearing.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteRequestAction.bind(null, hearing.slug)}>
                      <button type="submit" className="text-slate-400 underline underline-offset-4 hover:text-red-600">
                        削除
                      </button>
                    </form>
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
