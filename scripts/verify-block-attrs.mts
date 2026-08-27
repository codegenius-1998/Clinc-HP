// Proves that per-block presentation actually survives a save/load round trip (migration 0005).
//
//   npx tsx scripts/verify-block-attrs.mts
//
// Before 0005, `site_sections` held only `block.data`, so `variant` / `spacing` / `textStyles` /
// `containerStyles` — and the document-level `metaTextStyles` / `chromeSpacing` — were written by the
// code, accepted by the schema, and silently dropped by the writer. This replays the exact path the
// app uses (saveDocument -> getDocument) against real D1 rows rather than mocking it, which is what
// docs/TESTCASES.md asks for in the absence of a test framework.
//
// ⚠️ It WRITES to D1. It targets the seeded template `typographic-template`, restores its original
// blocks at the end, and re-renders so the preview on disk matches the row again.
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const SLUG = process.argv.find((a) => !a.startsWith("--") && a.endsWith("template")) ?? "typographic-template";

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

await loadEnv();

const { d1Query } = await import("../src/lib/d1");
const { getDocument, getDocumentBySlug, saveDocument } = await import("../src/lib/site/store");
const { renderSiteFiles } = await import("../src/lib/render/renderSiteFiles");

let failures = 0;

/** Order-insensitive. zod re-emits an object's keys in SCHEMA order, not in the order they were
 * written, so a plain JSON.stringify comparison reports `{marginTop, paddingBottom}` as different
 * from `{paddingBottom, marginTop}` — a difference in this script, not in the stored value. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val
  );
}

function check(label: string, actual: unknown, expected: unknown) {
  const ok = stable(actual) === stable(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${ok ? "" : `\n       期待: ${stable(expected)}\n       実際: ${stable(actual)}`}`);
}

const original = await getDocumentBySlug(SLUG);
if (!original) {
  console.error(`「${SLUG}」が見つかりません。先に npx tsx scripts/seed-template.mts typographic を実行してください。`);
  process.exit(2);
}
// A snapshot to restore from, taken before anything is written.
const restore = structuredClone(original);
const target = original.blocks.find((b) => b.type === "rich");
if (!target) {
  console.error(`「${SLUG}」に rich ブロックがありません。`);
  process.exit(2);
}

console.log(`対象: ${original.name} (${SLUG}) / ブロック ${target.id}\n`);

// ── 1. Round trip ────────────────────────────────────────────────────────────────────────────────
const VARIANT = "list";
const SPACING = { marginTop: 40, paddingBottom: 24 };
const TEXT_STYLES = { heading: { color: "#ff0000", fontSize: 22 } };
const CONTAINER_STYLES = { "card.0": { background: "#eeeeee" } };
const META_TEXT_STYLES = { clinicName: { fontSize: 20 } };
const CHROME_SPACING = { header: { paddingTop: 12 } };

const edited = structuredClone(original);
const editedBlock = edited.blocks.find((b) => b.id === target.id)!;
Object.assign(editedBlock, {
  variant: VARIANT,
  spacing: SPACING,
  textStyles: TEXT_STYLES,
  containerStyles: CONTAINER_STYLES,
});
edited.metaTextStyles = META_TEXT_STYLES;
edited.chromeSpacing = CHROME_SPACING;

await saveDocument(edited);
const reloaded = await getDocument(original.id);
if (!reloaded) {
  console.error("保存後に読み込めませんでした。");
  process.exit(1);
}
const reloadedBlock = reloaded.blocks.find((b) => b.id === target.id);

console.log("1. 保存 → 読み込みで値が残るか");
check("block.variant", reloadedBlock?.variant, VARIANT);
check("block.spacing", reloadedBlock?.spacing, SPACING);
check("block.textStyles", reloadedBlock?.textStyles, TEXT_STYLES);
check("block.containerStyles", reloadedBlock?.containerStyles, CONTAINER_STYLES);
check("doc.metaTextStyles", reloaded.metaTextStyles, META_TEXT_STYLES);
check("doc.chromeSpacing", reloaded.chromeSpacing, CHROME_SPACING);
check("ブロック数は変わらない", reloaded.blocks.length, original.blocks.length);

// ── 2. attrs が書かれているか（SQLレベル） ────────────────────────────────────────────────────────
// ⚠️ 「attrs のある行が1つ」ではなく「対象の行の attrs に variant が入っている」を見る。
// アーキタイプが cardCount を持たせるようになった時点で、テストが書き込む前から attrs のある行は
// 複数あるのが正常になった — 件数で判定すると、正しい変更のたびに落ちるテストになる。
const written = await d1Query<{ attrs: string | null }>(
  "SELECT attrs FROM site_sections WHERE id = ?",
  [`${original.id}:${target.id}`]
);
const storedAttrs = written.results[0]?.attrs ?? "";
console.log("\n2. attrs 列に実際に書かれているか");
check("対象ブロックの attrs に variant がある", storedAttrs.includes(`"variant":"${VARIANT}"`), true);
check("対象ブロックの attrs に textStyles がある", storedAttrs.includes('"textStyles"'), true);

// ── 3. 壊れた attrs でブロックが消えないか ───────────────────────────────────────────────────────
// これが二段階 safeParse の存在理由。ここで null を返すと、公開中のページからセクションが消える。
await d1Query("UPDATE site_sections SET attrs = ? WHERE id = ?", [
  '{"variant":42,"textStyles":{"!!bad path":{"color":"nope"}}}',
  `${original.id}:${target.id}`,
]);
const corrupted = await getDocument(original.id);
const corruptedBlock = corrupted?.blocks.find((b) => b.id === target.id);
console.log("\n3. attrs が壊れていても、ブロック自体は残るか（上に警告が1件出ていれば正常）");
check("ブロックは残る", Boolean(corruptedBlock), true);
check("ブロック数は変わらない", corrupted?.blocks.length, original.blocks.length);
check("variant は落ちる", corruptedBlock?.variant, undefined);
check("本文は無事", (corruptedBlock?.data as { heading?: string } | undefined)?.heading, (target.data as { heading?: string }).heading);

// ── 後片付け ─────────────────────────────────────────────────────────────────────────────────────
await saveDocument(restore);
await renderSiteFiles(restore);
const after = await getDocument(original.id);
console.log("\n4. 後片付け");
check("元の状態に戻っている", after?.blocks.find((b) => b.id === target.id)?.variant, restore.blocks.find((b) => b.id === target.id)?.variant);

console.log(failures === 0 ? "\n✅ すべて期待どおりです。" : `\n⛔ ${failures} 件が期待と異なります。`);
process.exit(failures === 0 ? 0 : 1);
