"use server";

import { revalidatePath } from "next/cache";
import { friendlyGenerationError, getHearing, updateHearing } from "./hearing";
import { generateSite } from "./siteGenerator";
import { deployGeneratedSiteToCloudflare } from "./cloudflareDeploy";

function generationErrorMessage(err: unknown): string {
  return err instanceof Error ? friendlyGenerationError(err.message) : "サイトの生成に失敗しました。";
}

export async function regenerateSiteAction(slug: string): Promise<void> {
  const hearing = await getHearing(slug);
  if (!hearing) {
    return;
  }

  try {
    const result = await generateSite(hearing);
    await updateHearing(slug, {
      previewUrl: result.previewUrl,
      generationError: undefined,
      templateId: result.templateId,
      templateLabel: result.templateName,
      templateReason: result.templateReason ?? undefined,
    });
  } catch (err) {
    await updateHearing(slug, { generationError: generationErrorMessage(err) });
  }

  revalidatePath(`/sites/${slug}`);
}

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
