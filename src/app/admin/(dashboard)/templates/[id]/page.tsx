import { notFound } from "next/navigation";
import { AccessDeniedError, requireEditableDocument } from "@/lib/site/access";
import { ensureRenderedSite } from "@/lib/render/renderSiteFiles";
import { SiteEditor } from "@/components/editor/SiteEditor";

/** Template editing. Same editor component as a clinic site — a template IS a SiteDocument, so there
 * is no separate "template editor" to keep in step with the real one. */
export default async function AdminTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let document;
  try {
    ({ document } = await requireEditableDocument(id));
  } catch (err) {
    // The admin layout already gates on role, so the only way here is a bad id.
    if (err instanceof AccessDeniedError) notFound();
    throw err;
  }

  const previewUrl = await ensureRenderedSite(document);

  return (
    <SiteEditor
      initialDocument={document}
      previewUrl={previewUrl}
      backHref="/admin/templates"
      backLabel="テンプレート管理"
    />
  );
}
