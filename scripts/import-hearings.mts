// One-off: copies data/hearings/*.json into the D1 `hearings` table (migration 0004).
//
//   npx tsx scripts/import-hearings.mts --dry-run   # 何が入るか見るだけ
//   npx tsx scripts/import-hearings.mts
//
// Re-runnable: saveHearing upserts on slug, so importing twice leaves the same rows. It never
// deletes the JSON files — removing them is a separate, deliberate step once the rows are verified.
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { readFile, readdir } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "hearings");

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

const dryRun = process.argv.includes("--dry-run");
await loadEnv();

const { getHearing, listHearings, saveHearing } = await import("../src/lib/hearing");
import type { HearingSheet } from "../src/lib/hearing";

let files: string[] = [];
try {
  files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
} catch {
  console.log(`${DATA_DIR} がありません。取り込むものはありません。`);
  process.exit(0);
}

if (files.length === 0) {
  console.log("取り込む JSON ファイルがありません。");
  process.exit(0);
}

console.log(`${files.length} 件のファイルを読み込みます${dryRun ? "（--dry-run: 書き込みません）" : ""}\n`);

let written = 0;
let skipped = 0;
for (const file of files.sort()) {
  const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
  let hearing: HearingSheet;
  try {
    hearing = JSON.parse(raw) as HearingSheet;
  } catch (err) {
    console.error(`⛔ ${file}: JSONとして読めません — ${err instanceof Error ? err.message : String(err)}`);
    skipped++;
    continue;
  }

  if (!hearing.slug || !hearing.clinicName || !hearing.createdAt) {
    console.error(`⛔ ${file}: slug / clinicName / createdAt のいずれかが欠けています。`);
    skipped++;
    continue;
  }

  const existing = await getHearing(hearing.slug);
  if (dryRun) {
    console.log(`${existing ? "上書き" : "新規  "}  ${hearing.slug}  ${hearing.clinicName}`);
    continue;
  }

  await saveHearing(hearing);
  written++;
  console.log(`✅ ${existing ? "更新" : "登録"}  ${hearing.slug}  ${hearing.clinicName}`);
}

if (dryRun) {
  console.log("\n--dry-run のため、何も書き込んでいません。");
  process.exit(skipped > 0 ? 1 : 0);
}

// Read everything back through the same code path the app uses, so the check exercises fromRow()
// rather than trusting that the insert worked.
const stored = await listHearings();
console.log(`\n書き込み ${written} 件 / 読み飛ばし ${skipped} 件`);
console.log(`D1 の hearings: ${stored.length} 件`);
for (const hearing of stored) {
  const staff = hearing.staffMembers?.length ?? 0;
  const prices = hearing.priceItems?.length ?? 0;
  console.log(
    `  ${hearing.slug}  ${hearing.clinicName}  スタッフ${staff}名 / 料金${prices}件 / ` +
      `状態=${hearing.previewUrl ? "生成済み" : hearing.templateId ? "処理中" : "承認待ち"}`
  );
}

process.exit(skipped > 0 ? 1 : 0);
