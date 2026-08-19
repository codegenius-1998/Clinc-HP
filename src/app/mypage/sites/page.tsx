import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listHearingsByOwner } from "@/lib/hearing";
import { generatedSlugExists } from "@/lib/render/renderSiteFiles";
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

export default async function MypageSitesPage() {
  const session = await getSession();
  const hearings = await listHearingsByOwner(session!.email);
  // `previewUrl` alone only means generation once succeeded — confirm the files are still on disk
  // before listing it as a real site (see /sites for the same check).
  const generated = (
    await Promise.all(
      hearings.map(async (h) => (h.previewUrl && (await generatedSlugExists(h.slug)) ? h : null))
    )
  ).filter((h): h is NonNullable<typeof h> => h !== null);

  return (
    <div>
      <AdminPageHeader title="サイト一覧" description="生成が完了したホームページです。" />

      {generated.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-[14px] text-slate-500">生成済みのホームページはまだありません。</p>
          <p className="mt-2 text-[13px] text-slate-400">
            申請後、管理側でデザインテンプレートが割り当てられるとここに表示されます。
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {generated.map((hearing) => (
            <li key={hearing.slug} className="relative">
              <Link
                href={`/sites/${hearing.slug}/edit`}
                className="absolute right-5 top-5 z-10 rounded-full bg-slate-900 px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-slate-700"
              >
                編集する
              </Link>
              <Link
                href={`/sites/${hearing.slug}`}
                className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 transition-colors hover:border-sky-300 hover:bg-sky-50/40"
              >
                <div className="flex items-center gap-3 pr-24">
                  <p className="text-[16px] font-semibold text-slate-900">{hearing.clinicName}</p>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    生成済み
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">
                  {hearing.templateLabel ?? "デザイン未選定"}
                </p>
                {hearing.cloudflareUrl && <p className="mt-2 text-[12px] text-sky-600">{hearing.cloudflareUrl}</p>}
                <p className="mt-4 text-[12px] text-slate-400">{formatDate(hearing.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
