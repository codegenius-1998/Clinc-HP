// Renders every block variant at once and measures them in a real browser.
//
//   npx tsx scripts/check-variants.mts          # 検査して片付ける
//   npx tsx scripts/check-variants.mts --keep   # 目視用に残す（/generated/__variants/）
//
// No AI, no cost. Takes about a minute.
//
// Why a throwaway document rather than a fixture that lives in D1: the page it builds is
// deliberately abnormal — ten pages, no hero, several お問い合わせ on one page — because the point is
// to get every variant of every type onto a screen at once, not to be a plausible clinic site. Left
// in the database it would fail the structure checks on every `check-design.mts --all` run forever,
// and a check that always reports two problems is a check people stop reading. So the structural
// findings are filtered out here and only the RENDER findings are reported: horizontal scroll at
// 390px, broken images, a section overflowing its container. Those are the ones a new variant can
// actually introduce.
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { readFile, rm } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const SLUG = "__variants";

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

await loadEnv();

const keep = process.argv.includes("--keep");

const { getDocumentBySlug, getDocument, saveDocument, deleteDocument, newDocumentId, listTemplates } = await import(
  "../src/lib/site/store"
);
const { renderSiteFiles, siteOutputPath } = await import("../src/lib/render/renderSiteFiles");
const { BLOCK_VARIANTS } = await import("../src/lib/site/composition");
const { createBlock } = await import("../src/lib/site/blocks");
const { checkRenderedPages } = await import("../src/lib/site/renderCheck");
const { pageFileName } = await import("../src/lib/site/pages");
const { documentImageSlots, needsGeneratedFile } = await import("../src/lib/site/imagePaths");
const { applyImagePaths } = await import("../src/lib/siteGenerator");
const { access } = await import("fs/promises");
const exists = async (file: string) => access(file).then(() => true, () => false);
import type { Block, BlockType, SiteDocument } from "../src/lib/site/document";

/** A template to take the design tokens from, and any document that already has realistic block
 * DATA — empty tables and empty card lists measure nothing.
 *
 * ⚠️ Any template will do now: since templates moved to `src/lib/site/templates/*.json` each one
 * ships with its own fictional clinic's rows, cards, staff and FAQ. Before that they were seeded
 * with the shared placeholder set, which is why this used to reach for a real generated site first. */
const templates = await listTemplates();
const donorTemplate = templates[0] && (await getDocument(templates[0].id));
if (!donorTemplate) {
  console.error("テンプレートが1件もありません。");
  process.exit(2);
}
// ⚠️ テンプレート自身が本物らしいデータを持つようになった（各 JSON に架空の医院の文章がある）ので、
// 借り先は原則テンプレートで足ります。実サイトを優先するのは、実際の行数・文字数で測れるときだけ。
const contentDonor = (await getDocumentBySlug("demo-multipage")) ?? donorTemplate;
const dataByType = new Map<BlockType, unknown>(contentDonor.blocks.map((b) => [b.type, b.data]));

const existing = await getDocumentBySlug(SLUG);
const doc: SiteDocument = structuredClone(donorTemplate);
doc.id = existing?.id ?? newDocumentId();
doc.slug = SLUG;
doc.name = "全バリアント確認";
doc.isTemplate = false;
doc.canSell = false;
doc.mood = undefined;
doc.pages = [];
doc.blocks = [];

// One page per block type, one section per variant — so a finding names the variant it came from.
for (const [type, variants] of Object.entries(BLOCK_VARIANTS) as [BlockType, readonly string[]][]) {
  if (type === "hero") continue; // singleton, and already covered by every template's own preview
  const pageId = `p-${type}`;
  doc.pages.push({
    id: pageId,
    path: doc.pages.length === 0 ? "" : type.toLowerCase(),
    navLabel: type,
    title: "",
    metaDescription: "",
    inNav: true,
  });
  for (const variant of variants) {
    const block = createBlock(type, { pageId, id: `${type}-${variant}`, variant, navLabel: variant } as never);
    const donated = dataByType.get(type);
    if (donated) block.data = structuredClone(donated) as Block["data"];
    doc.blocks.push(block);
  }
}

await saveDocument(doc);
const built = (await getDocument(doc.id))!;
const { outDir } = siteOutputPath(built);

// Real photographs, so images are measured rather than placeholders.
const { copyFile, mkdir, readdir } = await import("fs/promises");
await mkdir(path.join(outDir, "images"), { recursive: true });
const donorImages = path.join(siteOutputPath(contentDonor).outDir, "images");
for (const file of await readdir(donorImages).catch(() => [])) {
  await copyFile(path.join(donorImages, file), path.join(outDir, "images", file)).catch(() => {});
}
// ⚠️ 借りてきたデータには、ディスクに無い画像を指すパスが混じりうる（提供元のサイトが後で
// 片付けられていれば必ずそうなる）。ここで見たいのはバリアントの見た目であって画像の実在では
// ないので、ファイルが無いスロットはパスごと落とす。applyImagePaths は「渡されなかったスロットで、
// 生成物ディレクトリを指しているものは空にする」という規則をすでに持っているので、そのまま使う。
const present = new Map<string, string>();
for (const slot of documentImageSlots(built)) {
  if (!needsGeneratedFile(slot.value)) continue;
  if (await exists(path.join(outDir, slot.value))) present.set(slot.slot, slot.value);
}
applyImagePaths(built, present);

await renderSiteFiles(built);

const total = built.blocks.length;
console.log(`${built.pages.length} ページ / ${total} バリアントを描画しました。`);
for (const page of built.pages) {
  console.log(`  ${(page.path || "(トップ)").padEnd(10)} ${built.blocks.filter((b) => b.pageId === page.id).map((b) => b.variant).join("  ")}`);
}

const issues = await checkRenderedPages(
  built.pages.map((page) => ({ path: path.join(outDir, pageFileName(page)), label: page.navLabel }))
);

console.log(`\n描画検査（390px / 1280px、全 ${built.pages.length} ページ）`);
if (issues.length === 0) {
  console.log("  ✅ 横スクロール・画像切れ・はみ出しはありません。");
} else {
  for (const issue of issues) {
    console.log(`  ⛔ [${issue.severity}] ${issue.location}\n     ${issue.reason}`);
  }
}

if (keep) {
  console.log(`\n--keep: /generated/${SLUG}/ に残しました。片付けるには --keep 無しでもう一度実行してください。`);
} else {
  await deleteDocument(built.id);
  await rm(outDir, { recursive: true, force: true });
  console.log("\n片付けました。");
}

process.exit(issues.length === 0 ? 0 : 1);
