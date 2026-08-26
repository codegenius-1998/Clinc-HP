// Replaces a seeded template's placeholder images with generated photographs.
//
//   npx tsx scripts/illustrate-template.mts typographic-template --dry-run   # 何枚・いくら分か見る
//   npx tsx scripts/illustrate-template.mts typographic-template
//   npx tsx scripts/illustrate-template.mts typographic-template --force     # 既にある画像も作り直す
//
// ⚠️ 課金があります。1スロットにつき gpt-image-2 の medium 品質1回分です。--dry-run で枚数を確認
// してから実行してください。既に画像があるスロットは既定で飛ばします。
//
// Why this exists: scripts/seed-template.mts installs a template pointing every image at
// `images/placeholder.svg`, deliberately, so seeding costs nothing. That is fine while the template
// is only a starting point for a real generation — the placeholder is never shown to a clinic. It
// stopped being fine when the public landing page started showing template screenshots as "this is
// what you get": a placeholder icon on a sales page reads as a broken product.
//
// ⚠️ Only slots the design actually DRAWS are filled. A `cardLayout: "minimal"` section renders no
// card images at all, so generating them would be billed API calls for files no <img> points at —
// `documentImageSlots` already knows this, which is why the list comes from there rather than from a
// second hand-written list of block types (that duplication is what caused BUG-01).
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();

/** Matches the generation pipeline's ASPECT_SIZE, so a template's photographs come out the same
 * shape as the ones a real clinic's site gets. */
const ASPECT_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1200x896",
  "16:9": "1200x672",
  "2:1": "1536x768",
};

/** House style for every sample photograph, so a template preview reads as one clinic rather than a
 * collection of unrelated pictures. */
const HOUSE_STYLE =
  "Editorial photography for a Japanese medical clinic website. Bright natural daylight, calm, " +
  "uncluttered, warm neutral palette of off-white, pale oak and muted green. Shallow depth of field. " +
  "No text, no lettering, no signage, no logo, no watermark. Not clinical-cold, not stock-photo staged.";

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Sample-clinic subject matter per placement. Keyed on the slot name's prefix, which is the block
 * id — the same key `applyImagePaths` writes back on. */
function subjectFor(slot: string, index: number): string {
  if (slot === "hero") {
    return "A wide, calm view into a small private clinic just after opening: pale walls, a light oak reception counter, a tall window with sheer curtains, one plant. Nobody in the frame.";
  }
  if (slot.startsWith("staff")) {
    return (
      "A relaxed head-and-shoulders portrait of a Japanese healthcare professional in a clean white coat, " +
      "standing against a plain pale wall, soft even light, a natural unforced expression. " +
      `Make this person clearly different from the other portraits on the same page (variation ${index + 1}).`
    );
  }
  if (slot.startsWith("gallery")) {
    return (
      "A quiet interior detail of a small clinic — a corridor, a corner of a waiting area, or a treatment " +
      `room seen from the doorway. Nobody in the frame. Variation ${index + 1}: a different room and a ` +
      "different angle from the other interior photographs on this page."
    );
  }
  // ⚠️ 背景写真は「絵」ではなく「地」。主題があると本文と喧嘩するので、焦点も対象も持たせない。
  // CSS 側で --bg のスクリムが 88% 重なることも織り込んで、明るく淡いものを指示する。
  if (slot === "backdrop") {
    return (
      "An extremely soft, almost abstract background texture for a web page: out-of-focus daylight on a " +
      "pale plaster wall, with the faintest suggestion of a leaf shadow. No subject, no focal point, no " +
      "objects, no people. Very low contrast, very bright, nothing that competes with text placed over it."
    );
  }
  if (slot.startsWith("greeting")) {
    return "A consultation desk by a window in a small clinic: a closed notebook, a stethoscope resting on the wood, a small plant. Nobody in the frame.";
  }
  return "A quiet, uncluttered corner of a small Japanese clinic in daylight. Nobody in the frame.";
}

await loadEnv();
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY が .env.local にありません。");
  process.exit(2);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const slug = args.find((a) => !a.startsWith("--"));

if (!slug) {
  console.error("使い方: npx tsx scripts/illustrate-template.mts <slug> [--dry-run] [--force]");
  process.exit(2);
}

const { getDocumentBySlug, saveDocument } = await import("../src/lib/site/store");
const { documentImageSlots, needsGeneratedFile } = await import("../src/lib/site/imagePaths");
const { applyImagePaths } = await import("../src/lib/siteGenerator");
const { renderSiteFiles, siteOutputPath } = await import("../src/lib/render/renderSiteFiles");
const { checkDesign } = await import("../src/lib/site/designCheck");

const doc = await getDocumentBySlug(slug);
if (!doc) {
  console.error(`「${slug}」に一致するドキュメントがありません。`);
  process.exit(2);
}

const { outDir, previewUrl } = siteOutputPath(doc);
const imagesDir = path.join(outDir, "images");

// A slot needs a picture when the design draws it AND what it currently holds is a path into this
// site's own images/ directory — which, for a freshly seeded template, is the placeholder.
const targets = documentImageSlots(doc).filter((slot) => slot.rendered && needsGeneratedFile(slot.value));

if (targets.length === 0) {
  console.log(`${doc.name}: 画像を描画するスロットがありません。`);
  process.exit(0);
}

// A slot whose file is already on disk costs nothing and is left alone. ⚠️ This has to be resolved
// before the count is printed: `needsGeneratedFile` only says "this path points inside our own
// images/ directory", which is equally true of a real photograph and of the placeholder, so the
// slot list on its own would have --dry-run quoting a price for pictures that already exist.
const plan = await Promise.all(
  targets.map(async (slot) => ({
    slot,
    relative: `images/${slot.slot}.jpg`,
    size: ASPECT_SIZE[slot.aspect] ?? "1024x1024",
    onDisk: await exists(path.join(outDir, `images/${slot.slot}.jpg`)),
  }))
);
const todo = plan.filter((item) => force || !item.onDisk);

console.log(
  `${doc.name}（${doc.slug}）— 描画される画像スロット ${plan.length} 件 / ` +
    `うち生成が必要 ${todo.length} 件（既にある ${plan.length - todo.length} 件）\n`
);

const paths = new Map<string, string>();
let made = 0;
let skipped = 0;
let failed = 0;

if (!dryRun) await mkdir(imagesDir, { recursive: true });

const OpenAI = (await import("openai")).default;
const openai = dryRun ? null : new OpenAI();

let index = 0;
for (const { slot, relative, size, onDisk } of plan) {
  const file = path.join(outDir, relative);

  if (dryRun) {
    const mark = force || !onDisk ? "生成" : "既存";
    console.log(`   ${mark}  ${slot.slot.padEnd(12)} ${size.padEnd(10)} ${slot.label}`);
    index++;
    continue;
  }

  if (!force && onDisk) {
    paths.set(slot.slot, relative);
    skipped++;
    index++;
    continue;
  }

  try {
    const result = await openai!.images.generate({
      model: "gpt-image-2",
      prompt: `${subjectFor(slot.slot, index)} ${HOUSE_STYLE}`,
      size,
      quality: "medium",
      output_format: "jpeg",
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("画像が返りませんでした。");
    await writeFile(file, Buffer.from(b64, "base64"));
    paths.set(slot.slot, relative);
    made++;
    console.log(`✅ ${slot.slot.padEnd(12)} ${size.padEnd(10)} ${slot.label}`);
  } catch (err) {
    failed++;
    console.error(`⛔ ${slot.slot}: ${err instanceof Error ? err.message : String(err)}`);
  }
  index++;
}

if (dryRun) {
  console.log(
    todo.length === 0
      ? "\n--dry-run: 生成が必要な画像はありません。実行しても課金は発生しません。"
      : `\n--dry-run のため、生成も保存もしていません。実行すると ${todo.length} 枚ぶん課金されます。`
  );
  process.exit(0);
}

// ⚠️ applyImagePaths clears any slot that still points inside this directory but produced no file —
// that is the point (a section with no photo beats one with a broken image), and it is what keeps the
// stored document honest about what is actually on disk.
applyImagePaths(doc, paths);
await saveDocument(doc);
await renderSiteFiles(doc);

const check = checkDesign(doc, { outDir });
console.log(`\n生成 ${made} 件 / 既存 ${skipped} 件 / 失敗 ${failed} 件`);
console.log(`プレビュー: ${previewUrl}`);
console.log(`デザイン検査: ${check.summary}`);
for (const issue of check.issues) {
  console.log(`  [${issue.severity}] ${issue.location} — ${issue.reason}`);
}
console.log("\n⚠️ 公開トップの見本画像を更新するには、続けて次を実行してください:");
console.log("   npx tsx scripts/shoot-templates.mts");

process.exit(failed > 0 ? 1 : 0);
