import { getHearing, type HearingSheet } from "./hearing";
import { readStoredTemplate } from "./buildSiteFromHearing";
import { normalizeTemplate } from "./generatedSite/normalize";
import type { SiteTemplate } from "./generatedSite/types";

/** Loads a hearing plus its generated-site template, normalised for the editor.
 *
 * Returns `null` when the hearing does not exist (callers `notFound()`); returns `template: null`
 * when the hearing exists but no site has been generated yet (callers show a friendly notice).
 * `trustLayout` keeps the current section set — opening the editor never re-adds baseline sections. */
export async function loadEditableSite(
  slug: string
): Promise<{ hearing: HearingSheet; template: SiteTemplate | null } | null> {
  const hearing = await getHearing(slug);
  if (!hearing) return null;

  const stored = hearing.generatedSite?.template ?? (await readStoredTemplate(slug));
  if (!stored) return { hearing, template: null };

  const template = normalizeTemplate(stored, {
    brandName: hearing.clinicName,
    department: hearing.department,
    hours: hearing.hours,
    trustLayout: true,
  });
  return { hearing, template };
}
