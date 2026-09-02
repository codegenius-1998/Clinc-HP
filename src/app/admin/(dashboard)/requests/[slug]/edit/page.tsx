import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadEditableSite } from "@/lib/generatedSiteEditor";
import { SiteEditorOverview } from "@/components/siteEditor/SiteEditorOverview";

/** /admin/requests/<slug>/edit — editor overview: theme + section list. Section content is edited
 * on `/admin/requests/<slug>/edit/<section>`. */
export default async function EditGeneratedSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const loaded = await loadEditableSite(slug);
  if (!loaded) notFound();

  if (!loaded.template) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">「{loaded.hearing.clinicName}」のサイトはまだ生成されていません。</p>
        <Link
          href="/admin/requests"
          className="mt-4 inline-block text-[13px] text-blue-600 underline underline-offset-4"
        >
          リクエスト一覧に戻ってサイト生成する
        </Link>
      </div>
    );
  }

  return (
    <SiteEditorOverview
      slug={slug}
      clinicName={loaded.hearing.clinicName}
      initialTemplate={loaded.template}
      initialUrl={`/api/generated/${slug}/`}
      backHref="/admin/requests"
      backLabel="リクエスト一覧"
      editBase={`/admin/requests/${slug}/edit`}
    />
  );
}
