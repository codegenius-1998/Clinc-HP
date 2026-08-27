// Re-renders stored documents to disk. No AI, no cost, no image is touched.
//
//   npx tsx scripts/render-sites.mts --all
//   npx tsx scripts/render-sites.mts <slug|id>
//
// Needed because every generated site gets its own copy of src/lib/render/site.css and main.js. Edit
// either of those and the sites already on disk keep the old version until they are re-rendered —
// which otherwise only happens when someone opens the editor and presses 保存.
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const wantAll = args.includes("--all");
const target = args.find((a) => !a.startsWith("--"));

if (!wantAll && !target) {
  console.error("使い方: npx tsx scripts/render-sites.mts (--all | <slug|id>)");
  process.exit(2);
}

await loadEnv();

const { renderSiteFiles } = await import("../src/lib/render/renderSiteFiles");
const { getDocument, getDocumentBySlug, listSiteDocuments, listTemplates } = await import("../src/lib/site/store");
import type { SiteDocument } from "../src/lib/site/document";

let docs: SiteDocument[] = [];
if (target) {
  const doc = (await getDocumentBySlug(target)) ?? (await getDocument(target));
  if (!doc) {
    console.error(`「${target}」に一致するサイト・テンプレートが見つかりません。`);
    process.exit(2);
  }
  docs = [doc];
} else {
  for (const summary of [...(await listTemplates()), ...(await listSiteDocuments())]) {
    const doc = await getDocument(summary.id);
    if (doc) docs.push(doc);
  }
}

let failed = 0;
for (const doc of docs) {
  try {
    await renderSiteFiles(doc);
    console.log(`✅ ${doc.isTemplate ? "テンプレート" : "サイト"} ${doc.slug} — ${doc.name}`);
  } catch (err) {
    failed++;
    console.error(`⛔ ${doc.slug}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n${docs.length} 件中 ${docs.length - failed} 件を書き出しました。`);
process.exit(failed > 0 ? 1 : 0);
