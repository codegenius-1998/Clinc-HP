// Runs the design check over stored sites and templates, and reports what would look broken.
//
// Two layers, matching src/lib/site/: the static check reads the document (free, instant), and the
// render check opens the generated index.html in a real browser and measures it. Neither calls the
// AI, so this costs nothing and can be run as often as you like.
//
//   npx tsx scripts/check-design.mts --all          # every template and every generated site
//   npx tsx scripts/check-design.mts <slug|id>      # one document
//   npx tsx scripts/check-design.mts --all --static # skip the browser (no Playwright needed)
//
// Exits 1 when anything is reported as 要修正 (high), so it can gate a release.
//
// The env file is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { existsSync } from "fs";
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
const staticOnly = args.includes("--static");
const target = args.find((a) => !a.startsWith("--"));

if (!wantAll && !target) {
  console.error("使い方: npx tsx scripts/check-design.mts (--all | <slug|id>) [--static]");
  process.exit(2);
}

await loadEnv();

const { checkDesign } = await import("../src/lib/site/designCheck");
const { siteOutputPath } = await import("../src/lib/render/renderSiteFiles");
const { getDocument, getDocumentBySlug, listSiteDocuments, listTemplates } = await import("../src/lib/site/store");
import type { DesignIssue } from "../src/lib/site/designCheck";
import type { SiteDocument } from "../src/lib/site/document";

const SEVERITY_MARK = { high: "⛔ 要修正", medium: "⚠️  要確認", low: "・ 改善余地" } as const;

async function resolveTargets(): Promise<SiteDocument[]> {
  if (target) {
    const doc = (await getDocumentBySlug(target)) ?? (await getDocument(target));
    if (!doc) {
      console.error(`「${target}」に一致するサイト・テンプレートが見つかりません。`);
      process.exit(2);
    }
    return [doc];
  }

  // Summaries carry no blocks, so each one has to be re-read in full before it can be checked.
  const summaries = [...(await listTemplates()), ...(await listSiteDocuments())];
  const docs: SiteDocument[] = [];
  for (const summary of summaries) {
    const doc = await getDocument(summary.id);
    if (doc) docs.push(doc);
  }
  return docs;
}

function report(label: string, issues: DesignIssue[]): { high: number; medium: number } {
  const high = issues.filter((i) => i.severity === "high").length;
  const medium = issues.filter((i) => i.severity === "medium").length;
  const low = issues.length - high - medium;

  const headline =
    issues.length === 0 ? "✅ 問題なし" : `${high > 0 ? "⛔" : medium > 0 ? "⚠️ " : "・"} 要修正${high} / 要確認${medium} / 改善余地${low}`;
  console.log(`\n${headline}  ${label}`);

  for (const issue of issues) {
    console.log(`   ${SEVERITY_MARK[issue.severity]}  [${issue.code}] ${issue.location}`);
    console.log(`        ${issue.reason}`);
    console.log(`        → ${issue.suggestion}`);
  }
  return { high, medium };
}

const docs = await resolveTargets();
let totalHigh = 0;
let totalMedium = 0;
let rendered = 0;
let renderSkipped = 0;

for (const doc of docs) {
  const { outDir } = siteOutputPath(doc);
  const issues = [...checkDesign(doc, { outDir }).issues];

  const indexHtml = path.join(outDir, "index.html");
  if (!staticOnly) {
    if (!existsSync(indexHtml)) {
      renderSkipped++;
    } else {
      try {
        const { checkRenderedSite } = await import("../src/lib/site/renderCheck");
        issues.push(...(await checkRenderedSite(indexHtml)));
        rendered++;
      } catch (err) {
        console.error(`\n描画検査を実行できませんでした: ${err instanceof Error ? err.message : String(err)}`);
        console.error("以降は静的検査のみで続行します（--static を付けるとこの警告は出ません）。");
        renderSkipped++;
      }
    }
  }

  const counts = report(`${doc.isTemplate ? "テンプレート" : "サイト"} ${doc.slug} — ${doc.name}`, issues);
  totalHigh += counts.high;
  totalMedium += counts.medium;
}

console.log(
  `\n────────\n対象 ${docs.length} 件 / 描画検査 ${rendered} 件${renderSkipped > 0 ? `（${renderSkipped} 件は未生成などのため静的のみ）` : ""}`
);
console.log(totalHigh > 0 ? `⛔ 要修正 ${totalHigh} 件` : totalMedium > 0 ? `⚠️  要確認 ${totalMedium} 件` : "✅ すべて問題なし");

process.exit(totalHigh > 0 ? 1 : 0);
