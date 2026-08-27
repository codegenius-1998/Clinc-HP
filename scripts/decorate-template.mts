// Gives an EXISTING template its decoration — pattern, ambient motion, header and footer form.
//
//   npx tsx scripts/decorate-template.mts <slug> --dry-run   # 当たる値を見るだけ
//   npx tsx scripts/decorate-template.mts <slug>             # 適用して再描画
//   npx tsx scripts/decorate-template.mts --all              # 全テンプレートに
//   npx tsx scripts/decorate-template.mts <slug> --force     # 既に設定済みの軸も上書きする
//
// No AI and no image generation, so this costs nothing and takes a couple of seconds.
//
// Why a script and not a migration: templates imported before site/decoration.ts existed were saved
// with every decorative axis at its default, and fixing the importer does not reach backwards. This
// is the one-off that brings them forward.
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
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const all = args.includes("--all");
const slug = args.find((a) => !a.startsWith("--"));

if (!slug && !all) {
  console.error("使い方: npx tsx scripts/decorate-template.mts <slug> [--dry-run] [--force] | --all");
  process.exit(2);
}

const { getDocument, getDocumentBySlug, listTemplates, saveDocument } = await import("../src/lib/site/store");
const { renderSiteFiles } = await import("../src/lib/render/renderSiteFiles");
const { applyDecoration, decorationFor, fillMissingDecoration } = await import("../src/lib/site/decoration");
import type { SiteDocument } from "../src/lib/site/document";

const targets: SiteDocument[] = [];
if (all) {
  for (const summary of await listTemplates()) {
    const doc = await getDocument(summary.id);
    if (doc) targets.push(doc);
  }
} else {
  const doc = await getDocumentBySlug(slug!);
  if (!doc) {
    console.error(`「${slug}」に一致するテンプレートがありません。`);
    process.exit(2);
  }
  targets.push(doc);
}

// ⚠️ Built up as we go, starting from what the other templates already use. Without this, running
// `--all` would hand every template the same pattern: each call would see the same "taken" set and
// `decorationFor` would answer with the same first unused value for all of them.
const taken = new Set<string>();
for (const doc of targets) {
  if (doc.design.layout.ornament !== "none") taken.add(doc.design.layout.ornament);
}

for (const doc of targets) {
  const before = {
    ornament: doc.design.layout.ornament,
    ambient: doc.design.animation.ambient,
    header: doc.design.chrome.header,
    footer: doc.design.chrome.footer,
  };
  const decoration = decorationFor(doc.id, taken, { hasPhone: doc.meta.phone.trim().length > 0 });
  const next = structuredClone(doc);
  if (force) applyDecoration(next.design, decoration);
  else fillMissingDecoration(next.design, decoration);

  const after = {
    ornament: next.design.layout.ornament,
    ambient: next.design.animation.ambient,
    header: next.design.chrome.header,
    footer: next.design.chrome.footer,
  };
  taken.add(after.ornament);

  const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== after[k]);
  console.log(
    `${doc.name}（${doc.slug}）\n` +
      `  地紋   ${before.ornament} → ${after.ornament}（濃さ ${next.design.layout.ornamentStrength}）\n` +
      `  動き   ${before.ambient} → ${after.ambient}\n` +
      `  ヘッダー ${before.header} → ${after.header}\n` +
      `  フッター ${before.footer} → ${after.footer}\n` +
      `  読み進みバー ${next.design.animation.progressBar ? "あり" : "なし"}`
  );

  if (dryRun) {
    console.log("  （--dry-run のため保存していません）\n");
    continue;
  }
  if (changed.length === 0) {
    console.log("  変更はありません。\n");
    continue;
  }
  const saved = await saveDocument(next);
  const { previewUrl } = await renderSiteFiles(saved);
  console.log(`  ✅ 保存して再描画しました: ${previewUrl}\n`);
}
