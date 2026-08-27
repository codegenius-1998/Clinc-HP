// Writes a template stored in D1 out as a library file — src/lib/site/templates/<key>.json.
//
//   npx tsx scripts/export-template.mts <slug> --key washi-mincho
//   npx tsx scripts/export-template.mts <slug> --key washi-mincho --description "和紙と明朝の…"
//   npx tsx scripts/export-template.mts <slug> --stdout        # 書き込まずに中身だけ見る
//
// No AI, no cost. This is what closes the loop: import a reference site → look at the result → if it
// is good, keep it as a file that ships with the app instead of living only in one database.
//
// ⚠️ Only the design half is written out — slug, name, mood, tags, design, meta, pages, blocks. The
// document's id, its timestamps and its ownership stay behind, because those belong to a row and not
// to a design. Re-seeding assigns fresh ones.
//
// ⚠️ You must add the import line to src/lib/site/templates/index.ts yourself; this script prints it.
// scripts/verify-templates.mts fails if the file and the registry disagree, so a forgotten line
// cannot reach production.
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "src/lib/site/templates");

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
const stdoutOnly = args.includes("--stdout");
const valueOf = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const key = valueOf("--key");
const description = valueOf("--description") ?? "";
const slug = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--key" && args[i - 1] !== "--description");

if (!slug || (!key && !stdoutOnly)) {
  console.error("使い方: npx tsx scripts/export-template.mts <slug> --key <ファイル名> [--description \"…\"] [--stdout]");
  process.exit(2);
}

const { getDocumentBySlug } = await import("../src/lib/site/store");
const { toTemplateFile } = await import("../src/lib/site/templateLibrary");

const doc = await getDocumentBySlug(slug);
if (!doc) {
  console.error(`「${slug}」に一致するドキュメントがありません。`);
  process.exit(2);
}
if (!doc.isTemplate) {
  console.error(`「${slug}」はテンプレートではありません。生成済みサイトをテンプレート化するには、管理画面の「作成済みサイトから作る」をお使いください。`);
  process.exit(2);
}

const file = toTemplateFile(doc, description);
const json = JSON.stringify(file, null, 2) + "\n";

if (stdoutOnly) {
  console.log(json);
  process.exit(0);
}

const out = path.join(DIR, `${key}.json`);
await writeFile(out, json);

console.log(`✅ ${out}`);
console.log(`   ${file.name}（${file.meta.clinicName}）— ${file.pages.length}ページ / ${file.blocks.length}ブロック`);
if (!description) {
  console.log(`\n⚠️ --description を付けていません。管理画面の「ページ構成」セレクトに説明が出ないので、`);
  console.log(`   ${out} の "description" を直接書いてください（verify-templates が空を落とします）。`);
}
console.log(`\n次にこの1行を src/lib/site/templates/index.ts に足してください:`);
console.log(`   import ${key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} from "./${key}.json";`);
console.log(`   …そして TEMPLATE_SOURCES に "${key}": ${key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())},`);
console.log(`\n確認: npx tsx scripts/verify-templates.mts`);
