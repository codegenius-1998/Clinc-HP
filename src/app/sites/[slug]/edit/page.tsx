import { redirect } from "next/navigation";
import { AccessDeniedError, requireEditableDocumentBySlug } from "@/lib/site/access";
import { ensureRenderedSite } from "@/lib/render/renderSiteFiles";
import { getSession } from "@/lib/auth";
import { SiteEditor } from "@/components/editor/SiteEditor";

/** Site editing, for the clinic that owns the site and for admins.
 *
 * This route sits outside both gated layouts on purpose: /admin/* is admin-only and /mypage/* is
 * clinic_owner-only, but this one screen has to serve both roles. The check therefore lives in the
 * page (and, more importantly, in every editor Server Action — see src/lib/site/access.ts). */
export default async function SiteEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let document;
  try {
    ({ document } = await requireEditableDocumentBySlug(slug));
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      const session = await getSession();
      redirect(session ? "/" : "/admin");
    }
    throw err;
  }

  const previewUrl = await ensureRenderedSite(document);
  const session = await getSession();

  return (
    <div className="flex-1 bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-[1600px]">
        <SiteEditor
          initialDocument={document}
          previewUrl={previewUrl}
          backHref={session?.role === "admin" ? "/admin/requests" : "/mypage/sites"}
          backLabel={session?.role === "admin" ? "リクエスト管理" : "サイト一覧"}
        />
      </div>
    </div>
  );
}
