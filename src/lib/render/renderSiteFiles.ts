import { mkdir, readFile, readdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { renderSiteHtml } from "./renderSiteHtml";
import { pageFileName } from "@/lib/site/pages";
import type { PageDef, SiteDocument } from "@/lib/site/document";

/** Writes a SiteDocument out as a standalone static site: one HTML file per page, plus
 * css/site.css + js/main.js + images/.
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

/** Written into every output directory as `images/placeholder.svg`. A template starts life with no
 * real photos, and a block the generator never filled (a gallery the AI didn't plan images for, say)
 * would otherwise render a broken image. An SVG keeps it to a few hundred bytes and lets it pick up
 * the site's own primary colour. */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="画像">
  <rect width="400" height="300" fill="#eef2f6"/>
  <g fill="none" stroke="#b7c2cd" stroke-width="6" stroke-linejoin="round">
    <rect x="120" y="100" width="160" height="110" rx="8"/>
    <path d="M132 190l40-42 30 30 26-24 40 36"/>
  </g>
  <circle cx="168" cy="132" r="12" fill="#b7c2cd"/>
</svg>
`;

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

/** The preview URL for one page of a document.
 *
 * ⚠️ `siteOutputPath().previewUrl` deliberately keeps pointing at `index.html` and is NOT changed:
 * it is persisted as `hearings.preview_url` in D1 and read back by screens that never load the
 * document. This is the additional accessor those screens don't need. */
export function pagePreviewUrl(doc: Pick<SiteDocument, "id" | "slug" | "isTemplate">, page: PageDef): string {
  const dir = siteOutputPath(doc).previewUrl.replace(/index\.html$/, "");
  return `${dir}${pageFileName(page)}`;
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

  const written = new Set<string>();
  for (const page of doc.pages) {
    const file = pageFileName(page);
    await writeFile(path.join(outDir, file), await renderSiteHtml(doc, page.id), "utf-8");
    written.add(file);
  }
  await sweepStaleHtml(outDir, written);

  await writeFile(path.join(outDir, "css", "site.css"), await readFile(SITE_CSS_SOURCE, "utf-8"), "utf-8");
  await writeFile(path.join(outDir, "js", "main.js"), await readFile(SITE_JS_SOURCE, "utf-8"), "utf-8");
  await writeFile(path.join(outDir, "images", "placeholder.svg"), PLACEHOLDER_SVG, "utf-8");

  return { outDir, previewUrl };
}

/** Deletes top-level .html files that no page claims any more.
 *
 * ⚠️ Not optional. This function deliberately never removes its output directory (see the note at the
 * top of the file), so renaming a page's path or deleting a page would otherwise leave the old file
 * on disk forever — and `wrangler pages deploy` uploads whatever tree it finds, which means a page
 * the clinic deleted stays live at its old URL.
 *
 * Safe precisely because it is scoped to top-level `*.html`, which this function is the sole author
 * of. `images/`, `css/` and `js/` are never touched. */
async function sweepStaleHtml(outDir: string, written: Set<string>): Promise<void> {
  let entries: string[] = [];
  try {
    entries = await readdir(outDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".html") || written.has(entry)) continue;
    await unlink(path.join(outDir, entry)).catch(() => {});
  }
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

/** Guarantees the editor has something to show in its preview iframe. A document can exist in D1
 * without its files existing on disk — a fresh checkout, a cleaned public/generated, or a dev server
 * killed mid-write — and an empty iframe reads as a broken editor rather than as a missing file. */
export async function ensureRenderedSite(doc: SiteDocument): Promise<string> {
  if (await generatedSiteExists(doc)) {
    return siteOutputPath(doc).previewUrl;
  }
  return (await renderSiteFiles(doc)).previewUrl;
}
