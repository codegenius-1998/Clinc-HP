// Checks that the archetype registry still reproduces the two block layouts it replaced.
//
//   npx tsx scripts/verify-archetypes.mts
//
// No AI, no D1, no cost. Runs in a second.
//
// `defaultTemplateBlocks()` and `typographicTemplateBlocks()` used to be literal arrays; they now
// delegate to src/lib/site/archetypes.ts so that both importers, the seed script and (from Phase 4)
// the URL importer can all choose between several shapes instead of hardcoding one.
//
// ⚠️ That refactor has to be exact, and "exact" is not something to take on trust. Block ids become
// the page's HTML anchors AND — via slotKey — the filenames of the generated photographs. The seeded
// `typographic-template` currently carries seven real images named after these ids; a drifted id
// would leave it pointing at files that do not exist, and the failure would surface as blank boxes
// on a template preview rather than as an error here.
//
// EXPECTED is the output captured from the literal arrays immediately before they were removed.
import { readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const { defaultTemplateBlocks } = await import("../src/lib/site/defaultTemplate");
const { typographicTemplateBlocks } = await import("../src/lib/site/typographicTemplate");
const { ARCHETYPES, ARCHETYPE_KEYS, archetypeBlocks } = await import("../src/lib/site/archetypes");
const { CARD_COUNT_RANGE, variantsFor } = await import("../src/lib/site/composition");
const { normalizePages } = await import("../src/lib/site/pages");

const EXPECTED = path.join(ROOT, "docs", "fixtures", "template-blocks.json");

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${ok || !detail ? "" : `\n       ${detail}`}`);
}

/** Compares only what the renderer and the image pipeline actually consume. `pageId` is excluded:
 * it did not exist when the fixture was captured, and every one of these blocks is on the home page. */
function shape(blocks: { id: string; type: string; navLabel: string; visible: boolean; data: unknown }[]) {
  return blocks.map((b) => ({ id: b.id, type: b.type, navLabel: b.navLabel, visible: b.visible, data: b.data }));
}

console.log("1. 置き換え前のブロック構成と一致するか");
const expected = JSON.parse(await readFile(EXPECTED, "utf-8")) as {
  classic: Parameters<typeof shape>[0];
  editorial: Parameters<typeof shape>[0];
};
for (const [name, actual, want] of [
  ["one-page-classic", defaultTemplateBlocks(), expected.classic],
  ["one-page-editorial", typographicTemplateBlocks(), expected.editorial],
] as const) {
  const a = JSON.stringify(shape(actual as never));
  const b = JSON.stringify(shape(want));
  check(`${name} (${actual.length} ブロック)`, a === b);
  if (a !== b) {
    const actualIds = (actual as never as { id: string }[]).map((x) => x.id).join(" ");
    console.log(`       期待: ${want.map((x) => x.id).join(" ")}\n       実際: ${actualIds}`);
  }
}

console.log("\n2. すべてのアーキタイプが妥当か");
for (const key of ARCHETYPE_KEYS) {
  const { pages, blocks } = archetypeBlocks(key);
  const ids = blocks.map((b) => b.id);
  const problems: string[] = [];

  // Document-wide, not per page: slotKey(blockId) is the generated image's filename and every page
  // shares one images/ directory.
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) problems.push(`ブロックIDの重複: ${[...new Set(dupes)].join(", ")}`);

  const known = new Set(pages.map((p) => p.id));
  const orphans = blocks.filter((b) => !known.has(b.pageId));
  if (orphans.length > 0) problems.push(`存在しないページを指すブロック: ${orphans.map((b) => b.id).join(", ")}`);

  for (const b of blocks) {
    if (b.variant && !variantsFor(b.type).includes(b.variant)) {
      problems.push(`${b.id}: 未知のバリアント "${b.variant}"`);
    }
    if (b.cardCount !== undefined && (b.cardCount < CARD_COUNT_RANGE.min || b.cardCount > CARD_COUNT_RANGE.max)) {
      problems.push(`${b.id}: cardCount ${b.cardCount} が範囲外`);
    }
  }

  // The same reconciliation the store runs on every read and write must find nothing to fix.
  const normalized = normalizePages(pages, blocks);
  if (normalized.changed) problems.push("normalizePages に修正された（構成が規約を満たしていない）");

  check(
    `${ARCHETYPES[key].label} — ${pages.length}ページ / ${blocks.length}ブロック`,
    problems.length === 0,
    problems.join(" / ")
  );
}

console.log(failures === 0 ? "\n✅ すべて期待どおりです。" : `\n⛔ ${failures} 件が期待と異なります。`);
process.exit(failures === 0 ? 0 : 1);
