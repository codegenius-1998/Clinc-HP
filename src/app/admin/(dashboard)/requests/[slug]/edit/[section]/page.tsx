import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadEditableSite } from "@/lib/generatedSiteEditor";
import { sectionExists } from "@/components/siteEditor/shared";
import { SectionEditorClient } from "@/components/siteEditor/SectionEditorClient";

/** /admin/requests/<slug>/edit/<section> — edit one section's content. */
export default async function EditSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  await requireAdmin();
  const { slug, section } = await params;
  const sectionId = decodeURIComponent(section);
  const loaded = await loadEditableSite(slug);
  if (!loaded) notFound();

  const editBase = `/admin/requests/${slug}/edit`;

  if (!loaded.template || !sectionExists(loaded.template, sectionId)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">このセクションは見つかりませんでした。</p>
        <Link href={editBase} className="mt-4 inline-block text-[13px] text-blue-600 underline underline-offset-4">
          セクション一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <SectionEditorClient
      key={sectionId}
      slug={slug}
      clinicName={loaded.hearing.clinicName}
      initialTemplate={loaded.template}
      initialUrl={`/api/generated/${slug}/`}
      sectionId={sectionId}
      editBase={editBase}
    />
  );
}
