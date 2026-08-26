// Replaces a template's placeholder images with generated photographs.
//
//   npx tsx scripts/illustrate-template.mts <slug> --dry-run   # 何枚・どのスロットか見る
//   npx tsx scripts/illustrate-template.mts <slug>
//   npx tsx scripts/illustrate-template.mts <slug> --limit 5   # 効きの大きい5枚だけ
//   npx tsx scripts/illustrate-template.mts <slug> --force     # 既にある画像も作り直す
//
// ⚠️ 課金があります。1スロットにつき画像生成1回分です。--dry-run で枚数を確認してから実行して
// ください。既に画像があるスロットは既定で飛ばします。
//
// The work itself lives in src/lib/template/illustrateTemplate.ts, because the admin screen's
// 「写真を作る」ボタン runs exactly this — and two copies of "which slots, in what order, with what
// prompt" would drift the first time one of them was edited.
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

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY が .env.local にありません。");
  process.exit(2);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitAt = args.indexOf("--limit");
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : undefined;
const slug = args.find((a, i) => !a.startsWith("--") && i !== limitAt + 1);

if (!slug) {
  console.error("使い方: npx tsx scripts/illustrate-template.mts <slug> [--dry-run] [--limit N] [--force]");
  process.exit(2);
}

const { getDocumentBySlug } = await import("../src/lib/site/store");
const { illustrateTemplate, planIllustration } = await import("../src/lib/template/illustrateTemplate");
const { siteOutputPath } = await import("../src/lib/render/renderSiteFiles");
const { checkDesign } = await import("../src/lib/site/designCheck");

const doc = await getDocumentBySlug(slug);
if (!doc) {
  console.error(`「${slug}」に一致するドキュメントがありません。`);
  process.exit(2);
}

const plan = await planIllustration(doc);
const todo = plan.filter((item) => force || !item.onDisk).slice(0, limit ?? plan.length);

console.log(
  `${doc.name}（${doc.slug}）— 描画される画像スロット ${plan.length} 件 / ` +
    `今回生成する ${todo.length} 件（既にある ${plan.filter((i) => i.onDisk).length} 件）\n`
);
for (const item of plan) {
  const mark = todo.includes(item) ? "生成" : item.onDisk ? "既存" : "対象外";
  console.log(`   ${mark}  ${item.slot.slot.padEnd(12)} ${item.slot.aspect.padEnd(6)} ${item.slot.label}`);
}

if (dryRun) {
  console.log(
    todo.length === 0
      ? "\n--dry-run: 生成が必要な画像はありません。実行しても課金は発生しません。"
      : `\n--dry-run のため、生成も保存もしていません。実行すると ${todo.length} 枚ぶん課金されます。`
  );
  process.exit(0);
}

const result = await illustrateTemplate(doc, { limit, force });
const { outDir, previewUrl } = siteOutputPath(doc);
const check = checkDesign(doc, { outDir });

console.log(`\n生成 ${result.made} 件 / 既存 ${result.skipped} 件 / 失敗 ${result.failed} 件 / 残り ${result.remaining} 件`);
console.log(`プレビュー: ${previewUrl}`);
console.log(`デザイン検査: ${check.summary}`);
for (const issue of check.issues) {
  console.log(`  [${issue.severity}] ${issue.location} — ${issue.reason}`);
}
console.log("\n⚠️ 公開トップの見本画像を更新するには、続けて次を実行してください:");
console.log("   npx tsx scripts/shoot-templates.mts");

process.exit(result.failed > 0 ? 1 : 0);
