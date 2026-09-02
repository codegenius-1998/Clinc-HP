// Exports a /preview/<slug> route as a plain, self-contained HTML/CSS/JS bundle for handing to a
// client — no Next.js runtime, no app chrome. CSS and JS are split PER SECTION (spec).
//
//   node scripts/export-static.mjs <slug> [<slug> ...] [--all] [--port 3000]
//   npm run export -- nojima
//
// Requires a running server on --port (default 3000): `npm run build && npm run start` in another
// terminal (`npm run dev` also works). The route sits behind src/proxy.ts's Basic auth, so
// PREVIEW_BASIC_AUTH from .env.local is sent as an Authorization header.
//
// Output (CSS・JS・HTML をセクションごとに分けるのが仕様):
//   public/_generated/<slug>/
//     index.html          組み立て済みの1枚
//     css/site.css        共有: トークン + リセット + 基本タイポ + モーション (site.css)
//     css/ui.css          共有: Container / SectionHeading
//     css/<section>.css   header / hero / schedule / news / reasons / greeting / philosophy /
//                         medical / fees / flow / faq / access / contact / footer
//                         — 使われているセクションのみ
//     html/<section>.html 各セクションの生マークアップ(同じ粒度)。index.html には触れず別途切り出す
//     js/motion.js        スクロール reveal / 進捗バー / ヘッダー影 / カウントアップ /
//                         スムーズスクロール (public/nj-motion.js をそのまま同梱)
//     template.json       このサイトの全設定(文言・画像・フォント・カラー)。data/template.json の写し
//     template.schema.json  上記のスキーマ
//
// ⚠️ HTML/CSS はビルド出力を正規表現で切り分けている。cheerio は依存に無く、マークアップは
// 機械生成で安定している。dev ビルドはソースファイルごとのコメントマーカ
// (`/* [project]/…/Header.module.css … */`) で分割し、prod(minify 済み)ではセレクタ内の
// `<Name>-module__` プレフィクスで分割する。壊れたらブラウザ MCP で
// `document.querySelector('.nj-site').outerHTML` を取ってくればよい。

import { readFile, readdir, mkdir, writeFile, stat, rm } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const PREVIEW_DIR = path.join(ROOT, "src", "app", "preview");
const OUT_ROOT = path.join(ROOT, "public", "_generated");

// セクションの並び = <link> の読み込み順（site → ui → 各セクション）。
const SECTION_ORDER = [
  "header",
  "hero",
  "schedule",
  "news",
  "reasons",
  "greeting",
  "philosophy",
  "medical",
  "fees",
  "flow",
  "faq",
  "access",
  "contact",
  "footer",
];

// CSS Module 名 → 出力バケット。ここに無い名前は "site" に入る。
const BUCKET = {
  Header: "header",
  HeroFullBleed: "hero",
  HeroSplit: "hero",
  Schedule: "schedule",
  News: "news",
  Reasons: "reasons",
  Greeting: "greeting",
  Philosophy: "philosophy",
  Medical: "medical",
  Fees: "fees",
  Flow: "flow",
  Faq: "faq",
  Access: "access",
  Contact: "contact",
  Footer: "footer",
  Container: "ui",
  SectionHeading: "ui",
  Button: "ui",
};

// --- args ---------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const portArg = argv[argv.indexOf("--port") + 1];
const PORT = /^\d+$/.test(portArg ?? "") ? Number(portArg) : 3000;
const ALL = flags.has("--all");
const slugArgs = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--port");

// --- env (same loader as scripts/migrate.mjs) ------------------------------------------------

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8").catch(() => "");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}

// --- helpers ---------------------------------------------------------------------------------------

function authHeaders() {
  const cred = process.env.PREVIEW_BASIC_AUTH?.trim();
  return cred ? { Authorization: `Basic ${Buffer.from(cred).toString("base64")}` } : {};
}

async function fetchText(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

function firstMatch(re, s, group = 1) {
  const m = s.match(re);
  return m ? m[group] : null;
}

/** The <div class="nj-site">…</div> outerHTML, Next.js artefacts removed. */
function extractNjSite(html) {
  const start = html.search(/<div[^>]*class="[^"]*\bnj-site\b/i);
  if (start === -1) throw new Error('<div class="nj-site"> not found in response');
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = html.indexOf(">", start) + 1;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return html
        .slice(start, re.lastIndex)
        .replace(/<link\b[^>]*>/gi, "")
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<script\b[^>]*\/>/gi, "")
        .replace(/<!--\s*\/?\$\s*-->/g, "")
        .replace(/<template\b[\s\S]*?<\/template>/gi, "");
    }
  }
  throw new Error('unbalanced <div class="nj-site">');
}

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param",
  "source", "track", "wbr",
]);

/** `<div class="nj-site">…</div>` の中身(開きタグと最後の </div> を除いた部分)。 */
function innerOfNjSite(outer) {
  const open = outer.match(/^<div\b[^>]*>/i);
  if (!open) return outer;
  return outer.slice(open[0].length, outer.lastIndexOf("</div>")).trim();
}

/** フラグメントの直下の要素を outerHTML 文字列の配列で返す(タグの深さを数えるだけ)。 */
function topLevelElements(inner) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  let depth = 0;
  let start = -1;
  let m;
  while ((m = re.exec(inner))) {
    const isClose = m[1] === "/";
    const tag = m[2].toLowerCase();
    const selfClose = m[3] === "/" || VOID_TAGS.has(tag);
    if (isClose) {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        out.push(inner.slice(start, re.lastIndex).trim());
        start = -1;
      }
    } else if (selfClose) {
      if (depth === 0) out.push(inner.slice(m.index, re.lastIndex).trim());
    } else {
      if (depth === 0 && start < 0) start = m.index;
      depth++;
    }
  }
  return out.filter(Boolean);
}

/** 直下要素 1 つ → 出力バケット名。CSS と同じく `<Name>-module__` プレフィクスで判定し、
 * それが無ければタグ名で header / footer を拾う。どれでもなければ null(index.html だけに残す)。 */
function sectionFileFor(el) {
  const cls = (el.match(/^<[a-zA-Z][\w-]*\b[^>]*\bclass="([^"]*)"/) || [, ""])[1];
  const mod = cls.match(/([A-Za-z][A-Za-z0-9]*)-module__/);
  if (mod && BUCKET[mod[1]] && BUCKET[mod[1]] !== "ui") return BUCKET[mod[1]];
  if (/^<header\b/i.test(el)) return "header";
  if (/^<footer\b/i.test(el)) return "footer";
  return null;
}

/** Split one CSS string into top-level chunks (rule or at-rule), brace/quote/comment aware. */
function topLevelChunks(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  let str = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (str) {
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'") {
      str = c;
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      const e = css.indexOf("*/", i + 2);
      i = e === -1 ? css.length : e + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      out.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return out.filter(Boolean);
}

/** module names referenced by `<Name>-module__` inside a string */
function modulesIn(s) {
  return [...new Set([...s.matchAll(/([A-Za-z][A-Za-z0-9]*)-module__/g)].map((m) => m[1]))];
}

/**
 * bundleCss (concatenation of every src_components_sections chunk) → { bucket: cssText }.
 * usedModules gates section CSS: rules belonging only to an unused module (HeroSplit, Button…)
 * are dropped.
 */
function splitCss(bundleCss, usedModules) {
  const buckets = {}; // name -> string[]
  const put = (name, css) => (buckets[name] ??= []).push(css.trim());

  // dev build carries a `/* [project]/src/components/sections/<path> [app-client] (css) */` header
  // before each source file's block. Prefer that; fall back to per-chunk prefix bucketing.
  const marker = /\/\*\s*\[project\]\/src\/components\/sections\/(.+?)\s*\[app-client\]\s*\(css\)\s*\*\//g;
  const markers = [...bundleCss.matchAll(marker)];

  if (markers.length > 0) {
    for (let i = 0; i < markers.length; i++) {
      const rel = markers[i][1].replace(/\\/g, "/");
      const from = markers[i].index + markers[i][0].length;
      const to = i + 1 < markers.length ? markers[i + 1].index : bundleCss.length;
      const body = bundleCss.slice(from, to).trim();
      if (!body) continue;
      if (rel === "site.css") {
        put("site", body);
      } else {
        const name = path.basename(rel).replace(/\.module\.css$/, "");
        if (usedModules.size && !usedModules.has(name)) continue; // drop unused module
        put(BUCKET[name] ?? "site", body);
      }
    }
    return finalize(buckets);
  }

  // Fallback: minified prod bundle, no comment markers — bucket each top-level chunk.
  for (const chunk of topLevelChunks(bundleCss)) {
    if (/^@keyframes\b|^@font-face\b|^@import\b|^@charset\b/i.test(chunk)) {
      put("site", chunk);
      continue;
    }
    const scope = /^@(media|supports|layer)\b/i.test(chunk)
      ? chunk.slice(chunk.indexOf("{") + 1)
      : chunk.slice(0, chunk.indexOf("{"));
    const mods = modulesIn(scope);
    if (mods.length === 0) {
      put("site", chunk);
      continue;
    }
    const used = usedModules.size ? mods.filter((m) => usedModules.has(m)) : mods;
    if (used.length === 0) continue; // every referenced module is unused → drop
    for (const b of new Set(used.map((m) => BUCKET[m] ?? "site"))) put(b, chunk);
  }
  return finalize(buckets);
}

function finalize(buckets) {
  const out = {};
  for (const [name, parts] of Object.entries(buckets)) {
    out[name] = parts.join("\n\n").trim() + "\n";
  }
  return out;
}

// public/nj-motion.js が読めないときのための最小フォールバック(メニューを閉じるだけ)。
const JS_FALLBACK = `// fallback: ナビのリンクをタップしたら CSS の開閉チェックボックスを閉じる。
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest('nav a[href^="#"]');
  if (!a) return;
  var t = document.getElementById("nj-nav");
  if (t) t.checked = false;
});
`;

function buildIndexHtml({ title, description, fontHref, cssFiles, jsFiles, body }) {
  const head = [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    description ? `<meta name="description" content="${description}">` : "",
    fontHref ? '<link rel="preconnect" href="https://fonts.googleapis.com">' : "",
    fontHref ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' : "",
    fontHref ? `<link rel="stylesheet" href="${fontHref}">` : "",
    ...cssFiles.map((f) => `<link rel="stylesheet" href="css/${f}">`),
    ...jsFiles.map((f) => `<script src="js/${f}" defer></script>`),
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
    "",
  ];
  return head.filter((l) => l !== "").join("\n");
}

function fmtBytes(n) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

// --- per-slug --------------------------------------------------------------------------------------

async function exportSlug(slug, base, headers) {
  const html = await fetchText(`${base}/preview/${slug}`, headers);

  const title = (firstMatch(/<title>([\s\S]*?)<\/title>/i, html) ?? slug).trim();
  const description = firstMatch(/<meta name="description" content="([^"]*)"/i, html);
  // page.tsx marks its Google-Fonts <link> with data-nj-font (families come from template.json).
  // Fallback: any googleapis css2 link that isn't the app-shell one (which carries "Shippori").
  const fontTag = firstMatch(/<link\b[^>]*\bdata-nj-font\b[^>]*>/i, html, 0);
  const fontHref = fontTag
    ? firstMatch(/href="([^"]+)"/i, fontTag)
    : [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]*)"/gi)]
        .map((m) => m[1])
        .filter((h) => !/Shippori/i.test(h))
        .pop() ?? null;

  // 全 CSS チャンクを取得し、`.nj-site` のスタイルを含むものだけ残す。dev(Turbopack)は
  // ファイル名に `src_components_sections` が入るが、prod は不透明なハッシュ名なので中身で判定する
  // (globals.css / Tailwind のチャンクはここで落ちる)。
  const allCssHrefs = [
    ...new Set([...html.matchAll(/href="(\/_next\/static\/[^"]*\.css)"/g)].map((m) => m[1])),
  ];
  const cssHrefs = [];
  let bundle = "";
  for (const href of allCssHrefs) {
    const txt = await fetchText(base + href, headers);
    if (/src_components_sections/.test(href) || /\.nj-site\b/.test(txt) || /-module__/.test(txt)) {
      cssHrefs.push(href);
      bundle += txt + "\n";
    }
  }
  if (cssHrefs.length === 0) {
    throw new Error("`.nj-site` を含む CSS チャンクが見つかりません — サーバは最新ビルドですか？");
  }

  const body = extractNjSite(html);
  const usedModules = new Set(modulesIn(body));

  const parts = splitCss(bundle, usedModules);

  // ordered file list: site, ui, then sections in SECTION_ORDER — only those that exist.
  const order = ["site", "ui", ...SECTION_ORDER];
  const cssFiles = order.filter((n) => parts[n]).map((n) => `${n}.css`);

  // JS は常に motion.js を同梱する(public/nj-motion.js をそのまま)。無くても表示は成立する。
  const motionSrc = await readFile(path.join(ROOT, "public", "nj-motion.js"), "utf-8").catch(
    () => JS_FALLBACK
  );
  const jsFiles = ["motion.js"];

  const banner = `/* Exported from /preview/${slug} — ${new Date().toISOString().slice(0, 10)}. Regenerate: npm run export -- ${slug} */\n`;

  // HTML もセクションごとに分ける(仕様)。index.html は組み立て済みの1枚として残し、
  // html/<section>.html に各セクションの生マークアップを切り出す(CMS 等に流し込む用)。
  // 各セクションファイルには先頭に <header>(メニュー)を入れて単体で使えるようにする。
  const sectionHtml = {}; // bucket -> html
  for (const el of topLevelElements(innerOfNjSite(body))) {
    const name = sectionFileFor(el);
    if (!name) continue;
    sectionHtml[name] = sectionHtml[name] ? `${sectionHtml[name]}\n${el}` : el;
  }
  const headerFrag = sectionHtml.header || "";
  if (headerFrag) {
    for (const name of Object.keys(sectionHtml)) {
      if (name === "header") continue;
      sectionHtml[name] = `${headerFrag}\n${sectionHtml[name]}`;
    }
  }
  const htmlFiles = ["header", ...SECTION_ORDER.filter((n) => n !== "header")]
    .filter((n) => sectionHtml[n])
    .map((n) => `${n}.html`);

  const outDir = path.join(OUT_ROOT, slug);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, "css"), { recursive: true });
  await mkdir(path.join(outDir, "js"), { recursive: true });
  await mkdir(path.join(outDir, "html"), { recursive: true });

  for (const [name, css] of Object.entries(parts)) {
    const head = name === "site" ? banner + "html,body{margin:0;padding:0}\n" : banner;
    await writeFile(path.join(outDir, "css", `${name}.css`), head + css, "utf-8");
  }
  await writeFile(path.join(outDir, "js", "motion.js"), motionSrc, "utf-8");

  const date = new Date().toISOString().slice(0, 10);
  for (const [name, frag] of Object.entries(sectionHtml)) {
    const withHeader = name !== "header" && headerFrag ? "（先頭にヘッダーメニュー付き）" : "";
    const head = `<!-- ${slug} / ${name}${withHeader} — /preview/${slug} からの書き出し (${date})。組み立て済みの1枚は ../index.html -->\n`;
    await writeFile(path.join(outDir, "html", `${name}.html`), head + frag + "\n", "utf-8");
  }

  const indexHtml = buildIndexHtml({ title, description, fontHref, cssFiles, jsFiles, body });
  await writeFile(path.join(outDir, "index.html"), indexHtml, "utf-8");

  // このサイトの設定 JSON とスキーマも同梱する(HTML/CSS/JS + JSON の一式で渡す)。
  const jsonFiles = [];
  for (const f of ["template.json", "template.schema.json"]) {
    const src = await readFile(path.join(ROOT, "src", "components", "sections", "data", f), "utf-8").catch(
      () => null
    );
    if (src != null) {
      await writeFile(path.join(outDir, f), src, "utf-8");
      jsonFiles.push(f);
    }
  }

  const listed = [
    "index.html",
    ...cssFiles.map((f) => `css/${f}`),
    ...jsFiles.map((f) => `js/${f}`),
    ...htmlFiles.map((f) => `html/${f}`),
    ...jsonFiles,
  ];
  const sized = await Promise.all(
    listed.map(async (f) => `${f} ${fmtBytes((await stat(path.join(outDir, f))).size)}`)
  );
  console.log(`  ✅ public/_generated/${slug}/`);
  for (const s of sized) console.log(`       ${s}`);
  if (!fontHref) console.log(`     ⚠ フォントの <link> が見つからず。フォールバック(丸ゴシック)で表示されます。`);
}

// --- main ----------------------------------------------------------------------------------------

async function main() {
  await loadEnv();
  const headers = authHeaders();
  const base = `http://localhost:${PORT}`;

  try {
    await fetch(base + "/", { headers });
  } catch {
    console.error(
      `⛔ ${base} に接続できません。別ターミナルでサーバを起動してください:\n` +
        `   npm run build && npm run start        (または npm run dev)`
    );
    process.exit(1);
  }

  let slugs = slugArgs;
  const entries = await readdir(PREVIEW_DIR, { withFileTypes: true }).catch(() => []);
  const found = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      await stat(path.join(PREVIEW_DIR, e.name, "page.tsx"));
      found.push(e.name);
    } catch {}
  }
  if (ALL) slugs = found;
  if (slugs.length === 0) {
    console.error("使い方: npm run export -- <slug> [<slug> ...] [--all] [--port 3000]");
    console.error(`利用可能な slug: ${found.join(", ") || "(src/app/preview に無し)"}`);
    process.exit(1);
  }

  console.log(`エクスポート (${base}):`);
  let failed = 0;
  for (const slug of slugs) {
    try {
      await exportSlug(slug, base, headers);
    } catch (err) {
      failed++;
      console.error(`  ⛔ ${slug}: ${err.message}`);
    }
  }
  console.log(
    failed === 0
      ? `\n完了。public/_generated/<slug>/ をそのまま静的ホストに置けます。`
      : `\n⛔ ${failed} 件が失敗しました。`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("エクスポートに失敗しました:", err.message);
  process.exit(1);
});
