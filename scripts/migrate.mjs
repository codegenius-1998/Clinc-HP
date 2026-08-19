// Applies migrations/*.sql to the Cloudflare D1 database over the same HTTP API the app uses
// (src/lib/d1.ts), so it needs no wrangler login — just the credentials already in .env.local.
//
// Usage: node scripts/migrate.mjs [--file 0003_site_documents.sql]
//
// Safe to re-run: statements are idempotent by construction (IF NOT EXISTS / INSERT OR IGNORE), and
// the one kind that can't be — ALTER TABLE ADD COLUMN — is allowed to fail with "duplicate column".
import { readFile, readdir } from "fs/promises";
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

/** Splits a migration into statements. Line comments are stripped first so a "--" line containing a
 * semicolon can't split a statement in half. No migration here puts a semicolon inside a literal. */
function statements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const IGNORABLE = [/duplicate column name/i, /already exists/i];

async function run(sql) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    }
  );
  const body = await res.json();
  if (!res.ok || !body.success) {
    const message = body.errors?.map((e) => e.message).join("; ") || res.statusText;
    if (IGNORABLE.some((pattern) => pattern.test(message))) return { skipped: message };
    throw new Error(message);
  }
  return { ok: true };
}

async function main() {
  await loadEnv();
  for (const key of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_D1_DATABASE_ID"]) {
    if (!process.env[key]) throw new Error(`${key} が .env.local にありません。`);
  }

  const only = process.argv.includes("--file") ? process.argv[process.argv.indexOf("--file") + 1] : null;
  const files = (await readdir(path.join(ROOT, "migrations")))
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !only || f === only)
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(ROOT, "migrations", file), "utf-8");
    let applied = 0;
    let skipped = 0;
    for (const statement of statements(sql)) {
      const result = await run(statement);
      if (result.skipped) skipped++;
      else applied++;
    }
    console.log(`${file}: ${applied} 件適用, ${skipped} 件スキップ（適用済み）`);
  }
}

main().catch((err) => {
  console.error("マイグレーションに失敗しました:", err.message);
  process.exit(1);
});
