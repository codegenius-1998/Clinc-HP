import Link from "next/link";
import { listHearings, hearingStatus } from "@/lib/hearing";
import { listDesignPresets } from "@/lib/designPresets";
import { deleteRequestAction, assignTemplateAction } from "@/lib/contentActions";
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
  const presets = listDesignPresets();

  return (
    <div>
      <AdminPageHeader title="リクエスト管理" description="クリニックオーナーから送信されたホームページ作成申請の一覧です。「審査待ち」の申請はデザインテンプレートを割り当てると生成されます。" />

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
                  <td className="px-4 py-3">
                    {status.key === "generated" ? (
                      <Link href={`/sites/${hearing.slug}`} className="text-slate-900 underline-offset-4 hover:underline">
                        {hearing.clinicName}
                      </Link>
                    ) : (
                      <span className="text-slate-900">{hearing.clinicName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {hearing.templateLabel ? `${hearing.templateLabel} ・ ${hearing.colorSchemeLabel}` : hearing.colorSchemeLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(hearing.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {status.key === "pending_template" && (
                        <form action={assignTemplateAction} className="flex items-center gap-2">
                          <input type="hidden" name="slug" value={hearing.slug} />
                          <select
                            name="templateId"
                            defaultValue=""
                            required
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-700"
                          >
                            <option value="" disabled>
                              テンプレートを選択
                            </option>
                            {presets.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-sky-500"
                          >
                            割り当てて生成
                          </button>
                        </form>
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
