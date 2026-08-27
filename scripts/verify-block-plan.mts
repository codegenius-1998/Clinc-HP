// Proves Phase 4's structural import: that a page plan proposed by a model is turned into something
// safe to save, and that the reference site's own WORDS cannot ride along with its skeleton.
//
//   npx tsx scripts/verify-block-plan.mts            # offline: the normalizer's rules
//   npx tsx scripts/verify-block-plan.mts --url URL  # online, free: what we read off a real site
//
// Runs no AI and touches no database, so it costs nothing and can be run on every change. The AI's
// job is to propose; every rule that decides what actually gets stored lives in blockPlan.ts, and
// that is what this exercises — with the adversarial inputs a model realistically produces.
import { readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();

async function loadEnv() {
  try {
    const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* offline mode needs no credentials */
  }
}
await loadEnv();

const { normalizeBlockPlan, resolveStructure, ALLOWED_NAV_LABELS } = await import("../src/lib/template/blockPlan");
const { applySampleCopy } = await import("../src/lib/template/sampleCopy");
const { buildDefaultTemplate } = await import("../src/lib/site/defaultTemplate");
const { siteDocumentSchema, RESERVED_PAGE_PATHS } = await import("../src/lib/site/document");
const { normalizePages } = await import("../src/lib/site/pages");
const { checkDesign } = await import("../src/lib/site/designCheck");
const { documentImageSlots, LOGO_SLOT } = await import("../src/lib/site/imagePaths");

type Plan = Parameters<typeof normalizeBlockPlan>[0];

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${ok || detail === undefined ? "" : `\n       ${JSON.stringify(detail)}`}`);
}

const block = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  navLabel: "",
  variant: null,
  cardCount: null,
  ...extra,
});

/** Wraps a plan's output in a real SiteDocument so the app's own checks can judge it. */
function asDocument(plan: ReturnType<typeof normalizeBlockPlan>) {
  return siteDocumentSchema.parse({
    ...buildDefaultTemplate(),
    pages: plan.pages,
    blocks: applySampleCopy(plan.blocks),
  });
}

// ── 1. 素直な複数ページの案はそのまま通る ────────────────────────────────────────────────────────
console.log("1. まともな案はそのまま通るか");
{
  const plan: Plan = [
    { path: "", navLabel: "ホーム", blocks: [block("hero"), block("news"), block("rich", { cardCount: 3 }), block("hours")] },
    { path: "about", navLabel: "当院について", blocks: [block("rich"), block("staff")] },
    { path: "access", navLabel: "アクセス", blocks: [block("access"), block("contact")] },
  ];
  const out = normalizeBlockPlan(plan);
  check("ページは3つ", out.pages.length === 3, out.pages.map((p) => p.path));
  check("トップの path は空", out.pages[0].path === "", out.pages[0]);
  check("2ページ目以降の path が残る", out.pages[1].path === "about" && out.pages[2].path === "access");
  check("ブロックの型と並びが保たれる", out.blocks.map((b) => b.type).join(",") === "hero,news,rich,hours,rich-2,staff,access,contact".replace(/-2/g, ""), out.blocks.map((b) => b.type));
  check("cardCount が残る", out.blocks.find((b) => b.type === "rich")?.cardCount === 3);
  // ⚠️ 見出しが空のままだと checkDesign が「見出しが空です」を出す。実測で取り込んだテンプレートの
  // 文章セクション4つがこの状態だった — 誰も data.heading を埋めていなかった。
  check(
    "見出しがナビ名から埋まる",
    out.blocks.every((b) => b.navLabel === "" || !("heading" in b.data) || String((b.data as Record<string, unknown>).heading ?? "").length > 0),
    out.blocks.map((b) => `${b.id}:${b.navLabel}:${(b.data as Record<string, unknown>).heading ?? "-"}`).join(" ")
  );
  check("すべてのブロックが実在するページを指す", out.blocks.every((b) => out.pages.some((p) => p.id === b.pageId)));
  check("ブロックIDは文書全体で一意", new Set(out.blocks.map((b) => b.id)).size === out.blocks.length, out.blocks.map((b) => b.id));

  const doc = asDocument(out);
  const structural = checkDesign(doc).issues.filter((i) => i.severity === "high" && i.code.startsWith("structure-"));
  check("checkDesign の構造HIGHはゼロ", structural.length === 0, structural);
  check("normalizePages が直すところは無い", normalizePages(doc.pages, doc.blocks).changed === false);
}

// ── 2. 参考サイトの文章は1文字も通さない ─────────────────────────────────────────────────────────
// ⚠️ これが Phase 4 で最も重要な検査。骨格を真似ることと、文章を写すことの境界そのもの。
console.log("\n2. 参考サイトの文章・医院名が結果に入らないか");
{
  const STOLEN = [
    "さくら歯科クリニック",
    "地域にいちばん近い歯医者さん",
    "痛くない治療への3つのこだわり",
    "03-1234-5678",
    "院長 田中 一郎",
  ];
  const plan: Plan = [
    {
      path: "",
      navLabel: STOLEN[0],
      blocks: [
        block("hero", { navLabel: STOLEN[1] }),
        block("rich", { navLabel: STOLEN[2] }),
        block("staff", { navLabel: STOLEN[4] }),
        block("contact", { navLabel: STOLEN[3] }),
      ],
    },
  ];
  const out = normalizeBlockPlan(plan);
  const json = JSON.stringify(asDocument(out));

  // 8文字のシングルに割って照合する。部分一致まで捕まえるので、切り詰めて紛れ込んだ場合も落ちる。
  const shingles = STOLEN.flatMap((text) =>
    Array.from({ length: Math.max(1, [...text].length - 7) }, (_, i) => [...text].slice(i, i + 8).join(""))
  );
  const leaked = shingles.filter((s) => json.includes(s));
  check("参考サイトの語句がどこにも現れない", leaked.length === 0, leaked);
  check(
    "navLabel はすべて許可リストの中",
    out.blocks.every((b) => b.navLabel === "" || ALLOWED_NAV_LABELS.has(b.navLabel)),
    out.blocks.map((b) => b.navLabel)
  );
  check("ページ名も許可リストの中", ALLOWED_NAV_LABELS.has(out.pages[0].navLabel), out.pages[0].navLabel);
  check("ページのtitle/descriptionは空のまま", out.pages.every((p) => p.title === "" && p.metaDescription === ""));

  // ロゴは meta の持ちもので、この案が触る範囲の外（テスト用の土台が既定テンプレートなので入る）。
  const slots = documentImageSlots(asDocument(out)).filter((s) => s.slot !== LOGO_SLOT);
  check(
    "ブロックの画像はすべてプレースホルダ",
    slots.every((s) => s.value === "" || s.value === "images/placeholder.svg"),
    slots.filter((s) => s.value !== "" && s.value !== "images/placeholder.svg").map((s) => s.value)
  );
}

// ── 3. 知らない値は落とすが、落としきったら既定へ退避する ────────────────────────────────────────
console.log("\n3. 知らない値・壊れた案の扱い");
{
  const out = normalizeBlockPlan([
    { path: "", navLabel: "ホーム", blocks: [block("hero"), block("testimonials"), block("blog"), block("news")] },
  ]);
  check("知らない型は捨てる", out.blocks.every((b) => b.type !== ("testimonials" as never)), out.blocks.map((b) => b.type));
  check("知っている型は残る", out.blocks.some((b) => b.type === "news"));

  const empty = normalizeBlockPlan([{ path: "", navLabel: "", blocks: [block("blog"), block("shop")] }]);
  check("全部知らない型なら標準構成に退避", empty.blocks.length === 12 && empty.pages.length === 1, empty.blocks.length);
  check("空の案も標準構成に退避", normalizeBlockPlan([]).blocks.length === 12);
}

// ── 4. URLの重複・予約語・日本語 ─────────────────────────────────────────────────────────────────
console.log("\n4. path の正規化");
{
  const out = normalizeBlockPlan([
    { path: "", navLabel: "ホーム", blocks: [block("hero")] },
    { path: "index", navLabel: "診療案内", blocks: [block("rich")] },
    { path: "診療案内", navLabel: "診療内容", blocks: [block("rich")] },
    { path: "About/", navLabel: "当院について", blocks: [block("staff")] },
    { path: "about", navLabel: "ご挨拶", blocks: [block("rich")] },
  ]);
  const paths = out.pages.map((p) => p.path);
  check("予約語は使われない", !paths.some((p) => RESERVED_PAGE_PATHS.has(p)), paths);
  check("日本語のpathは残らない", paths.every((p) => /^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p)), paths);
  check("重複しない", new Set(paths).size === paths.length, paths);
  check("大文字と末尾のスラッシュは正規化される", paths.includes("about"), paths);
  check("重複した about は about-2 になる", paths.includes("about-2"), paths);
}

// ── 5. 1ページに1つのもの・順番 ──────────────────────────────────────────────────────────────────
console.log("\n5. 重複セクションと並び順");
{
  const out = normalizeBlockPlan([
    { path: "", navLabel: "ホーム", blocks: [block("news"), block("hero"), block("hero"), block("contact")] },
    { path: "access", navLabel: "アクセス", blocks: [block("contact"), block("access")] },
  ]);
  const home = out.blocks.filter((b) => b.pageId === out.pages[0].id);
  check("ヒーローは1ページに1つ", home.filter((b) => b.type === "hero").length === 1);
  check("ヒーローは先頭に移動する", home[0].type === "hero", home.map((b) => b.type));
  check("お問い合わせはサイト全体で1つ", out.blocks.filter((b) => b.type === "contact").length === 1);
  check("お問い合わせはそのページの末尾", home[home.length - 1].type === "contact", home.map((b) => b.type));
}
{
  const out = normalizeBlockPlan([{ path: "", navLabel: "ホーム", blocks: [block("rich"), block("hours")] }]);
  check("トップにヒーローが無ければ足す", out.blocks[0].type === "hero", out.blocks.map((b) => b.type));
  check("お問い合わせが無ければ足す", out.blocks.some((b) => b.type === "contact"));
}
{
  const out = normalizeBlockPlan([
    { path: "", navLabel: "ホーム", blocks: [block("hero"), block("hours")] },
    { path: "access", navLabel: "アクセス", blocks: [block("hours"), block("access")] },
  ]);
  check(
    "同じ型が別ページにあってもIDは衝突しない",
    new Set(out.blocks.map((b) => b.id)).size === out.blocks.length,
    out.blocks.map((b) => b.id)
  );
}

// ── 6. 上限 ─────────────────────────────────────────────────────────────────────────────────────
console.log("\n6. 上限");
{
  const many: Plan = Array.from({ length: 10 }, (_, i) => ({
    path: `p${i}`,
    navLabel: "診療案内",
    blocks: Array.from({ length: 20 }, () => block("rich")),
  }));
  const out = normalizeBlockPlan(many);
  check("ページは6つまで", out.pages.length <= 6, out.pages.length);
  check("ブロックは24＋補完分まで", out.blocks.length <= 26, out.blocks.length);
  check("1ページ12ブロックまで", out.pages.every((p) => out.blocks.filter((b) => b.pageId === p.id).length <= 13));
  check("同じナビ名は1ページに1つだけ", out.pages.every((p) => {
    const labels = out.blocks.filter((b) => b.pageId === p.id && b.navLabel !== "").map((b) => b.navLabel);
    return new Set(labels).size === labels.length;
  }));
}

// ── 7. variant / cardCount ──────────────────────────────────────────────────────────────────────
console.log("\n7. variant と cardCount");
{
  const out = normalizeBlockPlan([
    {
      path: "",
      navLabel: "ホーム",
      blocks: [
        block("hero", { variant: "split" }),
        block("faq", { variant: "carousel" }),
        block("hours", { variant: "stripe" }),
        block("rich", { cardCount: 99 }),
        block("staff", { cardCount: 4 }),
        block("contact"),
      ],
    },
  ]);
  const by = (type: string) => out.blocks.find((b) => b.type === type);
  check("使える variant は残る", by("hero")?.variant === "split" && by("hours")?.variant === "stripe");
  check("使えない variant は捨てる", by("faq")?.variant === undefined, by("faq")?.variant);
  check("cardCount は2〜6に丸める", by("rich")?.cardCount === 6, by("rich")?.cardCount);
  check("カード以外の cardCount は捨てる", by("staff")?.cardCount === undefined, by("staff")?.cardCount);
}

// ── 8. アーキタイプ名を返してきたら、その型を使う ────────────────────────────────────────────────
console.log("\n8. アーキタイプ指定が独自案より優先されるか");
{
  const contradicting: Plan = [{ path: "", navLabel: "ホーム", blocks: [block("hero")] }];
  const named = resolveStructure("multi-page-clinic", contradicting);
  check("型を名乗ったら独自案は無視される", named.pages.length === 4, named.pages.map((p) => p.path));
  const custom = resolveStructure("custom", contradicting);
  check("custom のときだけ独自案を使う", custom.pages.length === 1 && custom.blocks.length >= 2);
  check("知らない型名も独自案として扱う", resolveStructure("brochure", contradicting).pages.length === 1);
}

// ── 9. 実サイトの構造抽出（--url を付けたときだけ・課金なし） ────────────────────────────────────
const urlArg = process.argv.indexOf("--url");
if (urlArg >= 0 && process.argv[urlArg + 1]) {
  const { extractDesignSignals, describeSignals } = await import("../src/lib/template/extractDesignSignals");
  console.log(`\n9. 実サイトの構造抽出: ${process.argv[urlArg + 1]}`);
  const signals = await extractDesignSignals(process.argv[urlArg + 1]);
  console.log(describeSignals(signals).split("## 参考サイトのページ構成")[1] ?? "(構造なし)");
  console.log("\n--- モデルに渡る構造 (JSON) ---");
  console.log(JSON.stringify(signals.structure, null, 2));
}

console.log(failures === 0 ? "\n✅ すべて期待どおりです。" : `\n⛔ ${failures} 件が期待と異なります。`);
process.exit(failures === 0 ? 0 : 1);
