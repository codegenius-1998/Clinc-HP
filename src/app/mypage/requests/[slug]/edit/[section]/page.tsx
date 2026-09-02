import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadEditableSite } from "@/lib/generatedSiteEditor";
import { sectionExists } from "@/components/siteEditor/shared";
import { SectionEditorClient } from "@/components/siteEditor/SectionEditorClient";

/** /mypage/requests/<slug>/edit/<section> — one section's content editor for the owning clinic_owner. */
export default async function OwnerEditSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "clinic_owner") redirect("/login");

  const { slug, section } = await params;
  const sectionId = decodeURIComponent(section);
  const loaded = await loadEditableSite(slug);
  if (!loaded || loaded.hearing.ownerEmail !== session.email) notFound();

  const editBase = `/mypage/requests/${slug}/edit`;

  if (!loaded.template || !sectionExists(loaded.template, sectionId)) {
    return (
      <div className="border border-line bg-paper p-8 text-center">
        <p className="text-[14px] leading-[1.9] text-ink-soft">このセクションは見つかりませんでした。</p>
        <Link href={editBase} className="mt-4 inline-block text-[13px] text-brand underline underline-offset-4">
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
