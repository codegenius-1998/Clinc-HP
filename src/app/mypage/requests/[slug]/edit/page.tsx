import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHearing } from "@/lib/hearing";
import { readStoredTemplate } from "@/lib/buildSiteFromHearing";
import { SiteEditor } from "@/components/siteEditor/SiteEditor";

/** /mypage/requests/<slug>/edit — the clinic owner's own copy of the site editor. Same component
 * and actions as the admin page; access is limited to the clinic_owner who submitted this sheet. */
export default async function OwnerEditSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "clinic_owner") redirect("/login");

  const { slug } = await params;
  const hearing = await getHearing(slug);
  if (!hearing || hearing.ownerEmail !== session.email) notFound();

  const template = hearing.generatedSite?.template ?? (await readStoredTemplate(slug));

  if (!template) {
    return (
      <div className="border border-line bg-paper p-8 text-center">
        <p className="text-[14px] leading-[1.9] text-ink-soft">
          「{hearing.clinicName}」のホームページはまだ作成されていません。作成後に編集できます。
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
    <SiteEditor
      slug={slug}
      clinicName={hearing.clinicName}
      initialTemplate={template}
      initialUrl={`/api/generated/${slug}/`}
      backHref="/mypage/requests"
      backLabel="申請一覧"
    />
  );
}
