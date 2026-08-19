import Link from "next/link";
import { notFound } from "next/navigation";
import { getHearing } from "@/lib/hearing";
import { regenerateSiteAction, deployToCloudflareAction } from "@/lib/actions";
import { generatedSlugExists } from "@/lib/render/renderSiteFiles";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rows: {
  key: "directorName" | "address" | "phone" | "line" | "department" | "hours" | "features" | "request";
  label: string;
}[] = [
  { key: "directorName", label: "院長名" },
  { key: "address", label: "住所" },
  { key: "phone", label: "電話番号" },
  { key: "line", label: "LINE" },
  { key: "department", label: "診療科" },
  { key: "hours", label: "診療時間" },
  { key: "features", label: "医院の特徴" },
  { key: "request", label: "ご要望" },
];

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8";
const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-[13px] font-medium tracking-[0.05em] text-white transition-transform hover:-translate-y-0.5 hover:bg-sky-500";

export default async function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hearing = await getHearing(slug);

  if (!hearing) {
    notFound();
  }

  // `previewUrl` alone only means generation once succeeded — the output directory can be gone
  // (dev server killed mid-write, folder cleaned up by hand) without the record ever being updated.
  const isGenerated = hearing.previewUrl ? await generatedSlugExists(slug) : false;

  return (
    <div className="flex-1 bg-gradient-to-b from-sky-50 via-white to-white px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <Link href="/sites" className="text-[13px] text-slate-400 transition-colors hover:text-slate-900">
          ← 一覧へ戻る
        </Link>

        <p className="mt-8 text-[12px] tracking-[0.35em] text-sky-500">
          {hearing.templateLabel} ・ {hearing.colorSchemeLabel}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {hearing.clinicName}
        </h1>
        <p className="mt-3 text-[12px] text-slate-400">作成日時: {formatDate(hearing.createdAt)}</p>

        <div className={`mt-10 ${cardClassName}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-slate-700">生成されたホームページ</p>
            <form action={regenerateSiteAction.bind(null, slug)}>
              <button
                type="submit"
                className="text-[12px] text-sky-600 underline decoration-dotted underline-offset-4 hover:text-sky-700"
              >
                AIで再生成する
              </button>
            </form>
          </div>

          {isGenerated && hearing.previewUrl ? (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <iframe src={hearing.previewUrl} className="h-[480px] w-full" title="ホームページのプレビュー" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a href={hearing.previewUrl} target="_blank" rel="noreferrer" className={buttonClassName}>
                  新しいタブで開く
                  <span aria-hidden>→</span>
                </a>

                <form action={deployToCloudflareAction.bind(null, slug)}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-[13px] font-medium tracking-[0.05em] text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cloudflareでプレビュー
                  </button>
                </form>
              </div>

              {hearing.cloudflareUrl && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
                  公開プレビュー:{" "}
                  <a href={hearing.cloudflareUrl} target="_blank" rel="noreferrer" className="underline">
                    {hearing.cloudflareUrl}
                  </a>
                </p>
              )}
              {hearing.cloudflareError && (
                <p className="mt-4 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {hearing.cloudflareError}
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {hearing.previewUrl && !isGenerated
                ? "以前は生成されていましたが、生成ファイルが見つかりません（削除された可能性があります）。「AIで再生成する」を押してください。"
                : (hearing.generationError ?? "まだ生成されていません。")}
            </p>
          )}
        </div>

        <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
          {rows.map(({ key, label }) => (
            <div key={key} className="grid gap-1 px-6 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
              <span className="text-[13px] font-medium text-slate-500">{label}</span>
              <span className="whitespace-pre-line text-[14px] text-slate-900">
                {hearing[key] || <span className="text-slate-300">未入力</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
