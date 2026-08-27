import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listHearingsByOwner } from "@/lib/hearing";
import { generatedSlugExists } from "@/lib/render/renderSiteFiles";
import { MypagePageHeader } from "@/components/mypage/MypageShell";

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
      <MypagePageHeader title="サイト一覧" description="生成が完了したホームページです。" />

      {generated.length === 0 ? (
        <div className="border border-dashed border-line bg-paper p-10 text-center">
          <p className="text-[14px] text-ink-soft">生成済みのホームページはまだありません。</p>
          <p className="mt-2 text-[13px] text-ink-soft/75">
            申請後、管理側でデザインテンプレートが割り当てられるとここに表示されます。
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {generated.map((hearing) => (
            <li key={hearing.slug} className="relative">
              <Link
                href={`/sites/${hearing.slug}/edit`}
                className="absolute right-5 top-5 z-10 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-medium text-paper transition-colors hover:bg-brand"
              >
                編集する
              </Link>
              <Link
                href={`/sites/${hearing.slug}`}
                className="block border border-line bg-paper p-6 transition-colors hover:border-brand"
              >
                <div className="flex items-center gap-3 pr-24">
                  <p className="text-[16px] font-semibold text-ink">{hearing.clinicName}</p>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    生成済み
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-ink-soft">
                  {hearing.templateLabel ?? "デザイン未選定"}
                </p>
                {hearing.cloudflareUrl && <p className="mt-2 text-[12px] text-brand">{hearing.cloudflareUrl}</p>}
                <p className="mt-4 text-[12px] text-ink-soft/75">{formatDate(hearing.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
