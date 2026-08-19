import { getSession, type SessionUser } from "@/lib/auth";
import { getDocument, getDocumentBySlug } from "./store";
import type { SiteDocument } from "./document";

/** Who may edit which document.
 *
 * Templates are admin-only: a template is shared infrastructure, and one clinic owner editing it
 * would silently change every site generated from it afterwards. A generated site belongs to the
 * clinic that requested it, so its owner may edit it — and an admin may edit anything.
 *
 * Lives outside auth.ts to keep that module free of a dependency on the document store. */

export class AccessDeniedError extends Error {
  constructor(message = "権限がありません。") {
    super(message);
  }
}

function assertCanEdit(document: SiteDocument, session: SessionUser | null): SessionUser {
  if (!session) throw new AccessDeniedError("ログインしてください。");
  if (session.role === "admin") return session;
  if (document.isTemplate) throw new AccessDeniedError("テンプレートを編集できるのは管理者のみです。");
  if (document.ownerEmail && document.ownerEmail === session.email) return session;
  throw new AccessDeniedError();
}

/** Loads a document and checks the caller may edit it, in one step.
 *
 * MUST be called at the top of every editor Server Action, not just when rendering the editor page:
 * a Server Action is a directly POST-able endpoint, so a page-level guard protects nothing. */
export async function requireEditableDocument(id: string): Promise<{ document: SiteDocument; session: SessionUser }> {
  const document = await getDocument(id);
  if (!document) throw new AccessDeniedError("サイトが見つかりません。");
  return { document, session: assertCanEdit(document, await getSession()) };
}

export async function requireEditableDocumentBySlug(
  slug: string
): Promise<{ document: SiteDocument; session: SessionUser }> {
  const document = await getDocumentBySlug(slug);
  if (!document) throw new AccessDeniedError("サイトが見つかりません。");
  return { document, session: assertCanEdit(document, await getSession()) };
}
