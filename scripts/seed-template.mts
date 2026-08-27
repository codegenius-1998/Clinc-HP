// Installs the built-in templates (src/lib/site/templates/*.json) into D1 and renders their previews.
//
//   npx tsx scripts/seed-template.mts --all              # 全部
//   npx tsx scripts/seed-template.mts one-page-editorial # 1つだけ（キーでも slug でも）
//   npx tsx scripts/seed-template.mts --all --force      # 既にあるものも上書きする
//
// Re-runnable: a template whose slug is already stored reuses that row's id, so it is updated rather
// than duplicated (`sites.slug` is unique — inserting a second row with the same slug is the failure
// that used to surface only at the very end of a generation run). Without --force it refuses, because
// overwriting would discard whatever an admin has since edited in the editor.
//
// No AI and no cost: templates ship pointing at `images/placeholder.svg`, which renderSiteFiles
// writes into every output directory. Replacing those with real photographs is a separate, billed
// step — `npx tsx scripts/illustrate-template.mts <slug>`, or the 管理画面の「写真を作る」ボタン.
//
// ⚠️ The sample copy comes from the JSON file and is NOT overwritten here. Each template carries its
// own fictional clinic; running applySampleCopy over it (which this script used to do) would replace
// every one of those words with the generic set and put all the templates back to looking alike.
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
await loadEnv();

const args = process.argv.slice(2);
const force = args.includes("--force");
const all = args.includes("--all");
const which = args.find((a) => !a.startsWith("--"));

const { TEMPLATES, TEMPLATE_KEYS, toDocument } = await import("../src/lib/site/templateLibrary");
const { getDocumentBySlug, newDocumentId, saveDocument } = await import("../src/lib/site/store");
const { renderSiteFiles } = await import("../src/lib/render/renderSiteFiles");
const { checkDesign } = await import("../src/lib/site/designCheck");
const { siteOutputPath } = await import("../src/lib/render/renderSiteFiles");

const keys = all
  ? TEMPLATE_KEYS
  : TEMPLATE_KEYS.filter((key) => key === which || TEMPLATES[key].slug === which);

if (keys.length === 0) {
  console.error(
    `使い方: npx tsx scripts/seed-template.mts <キー|slug> [--force] | --all\n` +
      `  使えるキー: ${TEMPLATE_KEYS.join(", ")}`
  );
  process.exit(2);
}

let installed = 0;
let refused = 0;

for (const key of keys) {
  const file = TEMPLATES[key];
  const existing = await getDocumentBySlug(file.slug);

  if (existing && !force) {
    console.log(`⏭  ${file.name}（${file.slug}）は既に登録されています。上書きするなら --force。`);
    refused++;
    continue;
  }

  // ⚠️ The stored row's id is reused, not regenerated. `sites.slug` is unique, and a template that
  // has already been generated FROM is referenced by `templateId` on those sites.
  const doc = toDocument(file, existing?.id ?? newDocumentId(), { canSell: existing?.canSell ?? true });
  const saved = await saveDocument(doc);
  const { outDir, previewUrl } = await renderSiteFiles(saved);
  const check = checkDesign(saved, { outDir: siteOutputPath(saved).outDir });

  console.log(
    `✅ ${file.name}（${file.slug}）— ${saved.pages.length}ページ / ${saved.blocks.length}ブロック / ` +
      `${saved.meta.clinicName}\n   ${previewUrl}\n   ${check.summary}`
  );
  for (const issue of check.issues.filter((i) => i.severity !== "low")) {
    console.log(`     [${issue.severity}] ${issue.location} — ${issue.reason}`);
  }
  installed++;
}

console.log(`\n登録 ${installed} 件 / 見送り ${refused} 件`);
if (installed > 0) {
  console.log("⚠️ 写真はまだプレースホルダです。入れるには:");
  console.log("   npx tsx scripts/illustrate-template.mts <slug>  （課金あり）");
}
