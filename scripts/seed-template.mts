// Installs a built-in template into D1 and renders its preview.
//
//   npx tsx scripts/seed-template.mts typographic
//   npx tsx scripts/seed-template.mts typographic --force   # overwrite an existing one
//
// Re-runnable: if a template with the same slug is already stored, its id is reused so the row is
// updated rather than duplicated (`sites.slug` is unique — inserting a second row with the same slug
// is the failure that used to surface only at the very end of a generation run). Without --force it
// refuses, because overwriting would discard whatever an admin has since edited in the editor.
//
// No AI and no cost: the template ships pointing at `images/placeholder.svg`, which renderSiteFiles
// writes into every output directory. Replacing those with real photographs is a separate, billed
// step — run a normal generation from the admin screen, or import the result as a new template.
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
const force = args.includes("--force");
const which = args.find((a) => !a.startsWith("--"));

if (which !== "typographic") {
  console.error("使い方: npx tsx scripts/seed-template.mts typographic [--force]");
  process.exit(2);
}

await loadEnv();

const { buildTypographicTemplate } = await import("../src/lib/site/typographicTemplate");
const { applySampleCopy } = await import("../src/lib/template/sampleCopy");
const { getDocumentBySlug, saveDocument } = await import("../src/lib/site/store");
const { renderSiteFiles, siteOutputPath } = await import("../src/lib/render/renderSiteFiles");
const { checkDesign } = await import("../src/lib/site/designCheck");

const doc = buildTypographicTemplate();
doc.blocks = applySampleCopy(doc.blocks);

const existing = await getDocumentBySlug(doc.slug);
if (existing) {
  if (!force) {
    console.error(
      `「${existing.name}」(${doc.slug}) は既に登録されています。上書きするなら --force を付けてください。\n` +
        "管理画面で編集した内容があれば失われます。"
    );
    process.exit(1);
  }
  doc.id = existing.id;
  doc.createdAt = existing.createdAt;
}

await saveDocument(doc);
await renderSiteFiles(doc);

const { outDir, previewUrl } = siteOutputPath(doc);
const result = checkDesign(doc, { outDir });

console.log(`${existing ? "更新" : "登録"}しました: ${doc.name} (${doc.slug})`);
console.log(`プレビュー: ${previewUrl}`);
console.log(`デザイン検査: ${result.summary}`);
for (const issue of result.issues) {
  console.log(`  [${issue.severity}] ${issue.location} — ${issue.reason}`);
}
