import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { renderSiteHtml } from "./renderSiteHtml";
import type { SiteDocument } from "@/lib/site/document";

/** Writes a SiteDocument out as a standalone static site: index.html + css/site.css + js/main.js.
 *
 * This deliberately calls no AI and touches no image file. It is the whole of what "保存" does in the
 * editor, which is why editing text costs nothing and takes a moment rather than a minute — image
 * generation only happens in siteGenerator.ts's AI path.
 *
 * It also never removes the output directory. The images live in `<outDir>/images/` and are NOT
 * reproducible from the document alone (they were generated or uploaded once); wiping the directory
 * on every save — which the pre-block generator did — would leave every <img> in the freshly written
 * HTML pointing at a file that no longer exists. */

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");
const SITE_CSS_SOURCE = path.join(process.cwd(), "src", "lib", "render", "site.css");
const SITE_JS_SOURCE = path.join(process.cwd(), "src", "lib", "render", "main.js");

/** Templates render to a reserved sibling directory so a template preview and a real clinic site can
 * never collide on a slug. The leading underscore keeps it out of the way of generated slugs, which
 * are always `[a-z0-9-]`. */
export function siteOutputPath(doc: Pick<SiteDocument, "id" | "slug" | "isTemplate">): {
  outDir: string;
  previewUrl: string;
} {
  const segment = doc.isTemplate ? path.join("_templates", doc.id) : doc.slug;
  return {
    outDir: path.join(GENERATED_ROOT, segment),
    previewUrl: `/generated/${doc.isTemplate ? `_templates/${doc.id}` : doc.slug}/index.html`,
  };
}

export async function generatedSiteExists(doc: Pick<SiteDocument, "id" | "slug" | "isTemplate">): Promise<boolean> {
  try {
    await readFile(path.join(siteOutputPath(doc).outDir, "index.html"));
    return true;
  } catch {
    return false;
  }
}

export async function renderSiteFiles(doc: SiteDocument): Promise<{ outDir: string; previewUrl: string }> {
  const { outDir, previewUrl } = siteOutputPath(doc);

  await mkdir(path.join(outDir, "images"), { recursive: true });
  await mkdir(path.join(outDir, "css"), { recursive: true });
  await mkdir(path.join(outDir, "js"), { recursive: true });

  const html = await renderSiteHtml(doc);
  await writeFile(path.join(outDir, "index.html"), html, "utf-8");
  await writeFile(path.join(outDir, "css", "site.css"), await readFile(SITE_CSS_SOURCE, "utf-8"), "utf-8");
  await writeFile(path.join(outDir, "js", "main.js"), await readFile(SITE_JS_SOURCE, "utf-8"), "utf-8");

  return { outDir, previewUrl };
}

/** Existence check for screens that only hold a hearing sheet's slug and never load the document. */
export async function generatedSlugExists(slug: string): Promise<boolean> {
  try {
    await readFile(path.join(GENERATED_ROOT, slug, "index.html"));
    return true;
  } catch {
    return false;
  }
}
