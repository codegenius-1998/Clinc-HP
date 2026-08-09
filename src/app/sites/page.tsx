import Link from "next/link";
import { listHearings } from "@/lib/hearing";
import { generatedSiteExists } from "@/lib/siteGenerator";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SitesPage() {
  const hearings = await listHearings();
  // `previewUrl` alone only means generation once succeeded — confirm the files are still on disk
  // before showing "生成済み" (the dev server can be killed mid-write, or the folder cleaned up by hand).
  const existsBySlug = new Map(
    await Promise.all(hearings.map(async (h) => [h.slug, h.previewUrl ? await generatedSiteExists(h.slug) : false] as const))
  );

  return (
    <div className="flex-1 bg-gradient-to-b from-sky-50 via-white to-white px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-[13px] text-slate-400 transition-colors hover:text-slate-900">
          ← トップへ戻る
        </Link>

        <p className="mt-8 text-[12px] tracking-[0.35em] text-sky-500">SITES</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          作成済みホームページ
        </h1>

        {hearings.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <p className="text-[14px] text-slate-500">まだホームページが作成されていません。</p>
            <Link
              href="/create"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-6 py-3 text-[13px] font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-sky-500"
            >
              ホームページ作成
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {hearings.map((hearing) => {
              const isGenerated = existsBySlug.get(hearing.slug) ?? false;
              return (
              <li key={hearing.slug}>
                <Link
                  href={`/sites/${hearing.slug}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 transition-colors hover:border-sky-300 hover:bg-sky-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[16px] font-semibold text-slate-900">{hearing.clinicName}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isGenerated
                          ? "bg-emerald-50 text-emerald-700"
                          : hearing.generationError || hearing.previewUrl
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isGenerated ? "生成済み" : hearing.generationError || hearing.previewUrl ? "生成失敗" : "未生成"}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {hearing.templateLabel} ・ {hearing.colorSchemeLabel}
                  </p>
                  <p className="mt-4 text-[12px] text-slate-400">{formatDate(hearing.createdAt)}</p>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
