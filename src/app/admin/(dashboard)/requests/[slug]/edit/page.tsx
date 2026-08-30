import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getHearing } from "@/lib/hearing";
import { readStoredTemplate } from "@/lib/buildSiteFromHearing";
import { SiteEditor } from "@/components/siteEditor/SiteEditor";

/** /admin/requests/<slug>/edit — hand-edit the generated clinic site: text, images, colours, fonts,
 * section order. Loads the template stored on the hearing row (falling back to the bundle's
 * template.json) and re-renders the static bundle on save. */
export default async function EditGeneratedSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const hearing = await getHearing(slug);
  if (!hearing) notFound();

  const template = hearing.generatedSite?.template ?? (await readStoredTemplate(slug));

  if (!template) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">
          「{hearing.clinicName}」のサイトはまだ生成されていません。
        </p>
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
    <SiteEditor
      slug={slug}
      clinicName={hearing.clinicName}
      initialTemplate={template}
      initialUrl={`/api/generated/${slug}/`}
    />
  );
}
