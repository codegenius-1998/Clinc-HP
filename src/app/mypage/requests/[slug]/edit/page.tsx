import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadEditableSite } from "@/lib/generatedSiteEditor";
import { SiteEditorOverview } from "@/components/siteEditor/SiteEditorOverview";

/** /mypage/requests/<slug>/edit — editor overview for the owning clinic_owner. Section content is
 * edited on `/mypage/requests/<slug>/edit/<section>`. */
export default async function OwnerEditSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "clinic_owner") redirect("/login");

  const { slug } = await params;
  const loaded = await loadEditableSite(slug);
  if (!loaded || loaded.hearing.ownerEmail !== session.email) notFound();

  if (!loaded.template) {
    return (
      <div className="border border-line bg-paper p-8 text-center">
        <p className="text-[14px] leading-[1.9] text-ink-soft">
          「{loaded.hearing.clinicName}」のホームページはまだ作成されていません。作成後に編集できます。
        </p>
        <Link
          href="/mypage/requests"
          className="mt-4 inline-block text-[13px] text-brand underline underline-offset-4 hover:text-brand-deep"
        >
          申請一覧に戻る
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
      backHref="/mypage/requests"
      backLabel="申請一覧"
      editBase={`/mypage/requests/${slug}/edit`}
    />
  );
}
