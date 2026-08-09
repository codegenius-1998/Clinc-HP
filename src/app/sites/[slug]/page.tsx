import Link from "next/link";
import { notFound } from "next/navigation";
import { getHearing } from "@/lib/hearing";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rows: { key: "directorName" | "address" | "phone" | "line" | "hours" | "features" | "request"; label: string }[] = [
  { key: "directorName", label: "院長名" },
  { key: "address", label: "住所" },
  { key: "phone", label: "電話番号" },
  { key: "line", label: "LINE" },
  { key: "hours", label: "診療時間" },
  { key: "features", label: "医院の特徴" },
  { key: "request", label: "ご要望" },
];

export default async function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hearing = await getHearing(slug);

  if (!hearing) {
    notFound();
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-sky-50 via-white to-white px-6 py-24">
      <div className="mx-auto max-w-2xl">
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

        <div className="mt-10 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
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
