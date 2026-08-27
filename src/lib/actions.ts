"use server";

import { revalidatePath } from "next/cache";
import { getHearing, updateHearing } from "./hearing";
import { deployGeneratedSiteToCloudflare } from "./cloudflareDeploy";

/** `regenerateSiteAction` used to live here, behind the "AIで再生成する" button on /sites/[slug]. The
 * button was removed at the client's request, and the action went with it rather than being left as
 * an unreferenced export: a Server Action stays directly POST-able whether or not any page renders a
 * form for it, and this one had no authentication while costing real money (a full AI run: text plus
 * 10-20 generated images) and overwriting the clinic's edited copy. Generation now happens only
 * through the admin-gated 「作成」 button (approveRequestAction), on /admin/requests and on the site's own detail page.
 *
 * Re-rendering after an edit does NOT need this: saveDocumentAction re-renders from the stored
 * SiteDocument without calling any model. */
export async function deployToCloudflareAction(slug: string): Promise<void> {
  const hearing = await getHearing(slug);
  if (!hearing?.previewUrl) {
    return;
  }

  try {
    const result = await deployGeneratedSiteToCloudflare(slug);
    await updateHearing(slug, { cloudflareUrl: result.url, cloudflareError: undefined });
  } catch (err) {
    await updateHearing(slug, {
      cloudflareError: err instanceof Error ? err.message : "Cloudflareへのデプロイに失敗しました。",
    });
  }

  revalidatePath(`/sites/${slug}`);
}
