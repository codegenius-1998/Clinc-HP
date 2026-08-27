// Checks the template library — src/lib/site/templates/*.json.
//
//   npx tsx scripts/verify-templates.mts
//
// No AI, no D1, no credentials, no cost. Runs in a second, so it belongs in every check pass.
//
// A template is now one JSON file: its structure, its palette, its decoration and its own fictional
// clinic's words. That removed a lot of TypeScript, and it moved a class of mistake from "the
// compiler catches it" to "nothing catches it". This is what catches it.
import { readdir, readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "src/lib/site/templates");

const { TEMPLATES, TEMPLATE_KEYS, templateFileSchema, templateLayout, toDocument } = await import(
  "../src/lib/site/templateLibrary"
);
const { BLOCK_DEFINITIONS } = await import("../src/lib/site/blocks");
const { checkDesign } = await import("../src/lib/site/designCheck");
const { normalizePages } = await import("../src/lib/site/pages");
const { variantsFor } = await import("../src/lib/site/composition");
const { navItems } = await import("../src/lib/site/pages");
const { STYLE_KITS, STYLE_KIT_KEYS } = await import("../src/lib/render/kits");

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${ok || detail === undefined ? "" : `\n       ${String(detail).slice(0, 400)}`}`);
}

// ── 1. ファイルと登録が一致しているか ─────────────────────────────────────────────────────────────
// ⚠️ これがこの検査の一番の目的。index.ts は静的 import で、書き忘れても TypeScript は何も言わない
// （ファイルがただ存在しないのと同じ）。本番でだけテンプレートが1つ足りない、という壊れ方をする。
console.log("1. JSONファイルと index.ts の登録が一致しているか");
{
  const onDisk = (await readdir(DIR)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
  const registered = [...TEMPLATE_KEYS].sort();
  check("ファイルが1つ以上ある", onDisk.length > 0, onDisk);
  check(
    "登録漏れが無い（JSONを置いたのに index.ts に import が無い）",
    onDisk.every((name) => registered.includes(name)),
    onDisk.filter((n) => !registered.includes(n)).join(", ")
  );
  check(
    "幽霊が無い（index.ts にあるのにファイルが無い）",
    registered.every((name) => onDisk.includes(name)),
    registered.filter((n) => !onDisk.includes(n)).join(", ")
  );
}

// ── 2. それぞれが妥当な定義か ───────────────────────────────────────────────────────────────────
console.log("\n2. それぞれのテンプレート定義");
const slugs = new Set<string>();
const clinicNames = new Set<string>();
for (const key of TEMPLATE_KEYS) {
  const raw = JSON.parse(await readFile(path.join(DIR, `${key}.json`), "utf-8"));
  const parsed = templateFileSchema.safeParse(raw);
  check(`${key}: スキーマを通る`, parsed.success, parsed.success ? "" : JSON.stringify(parsed.error?.issues?.slice(0, 3)));
  if (!parsed.success) continue;
  const file = parsed.data;

  check(`${key}: slug が重複しない`, !slugs.has(file.slug), file.slug);
  slugs.add(file.slug);
  check(`${key}: 管理画面用の説明がある`, file.description.trim().length > 0);

  // ⚠️ 文書全体で一意。slotKey(blockId, i) が生成画像のファイル名で、images/ は全ページ共有。
  const ids = file.blocks.map((b) => b.id);
  check(`${key}: ブロックIDが文書全体で一意`, new Set(ids).size === ids.length, ids.join(" "));

  const pageIds = new Set(file.pages.map((p) => p.id));
  check(`${key}: 全ブロックが実在するページを指す`, file.blocks.every((b) => pageIds.has(b.pageId)));
  check(`${key}: normalizePages が直すところは無い`, normalizePages(file.pages, file.blocks).changed === false);

  const badVariant = file.blocks.filter((b) => b.variant && !variantsFor(b.type).includes(b.variant));
  check(`${key}: 知らないバリアントが無い`, badVariant.length === 0, badVariant.map((b) => `${b.id}:${b.variant}`).join(", "));

  // ⚠️ 電話番号はテンプレートごとに変えない。もっともらしい番号は実在の誰かの番号になりうる。
  check(`${key}: 電話番号がダミーのまま`, file.meta.phone === "00-0000-0000", file.meta.phone);
  check(`${key}: 住所がダミーのまま`, file.meta.address.includes("〇〇"), file.meta.address);
  check(`${key}: mood がある（selectTemplate が読む唯一の材料）`, (file.mood ?? "").trim().length > 20);

  // ⚠️ スタイルキットは「名前」であって中身ではない（src/lib/render/kits/index.ts）。名前が実在
  // しなければ黙って素の見た目に戻る＝間違いに気づけない、というのがこの検査の理由。
  const kitKey = file.design.layout.styleKit;
  if (kitKey) {
    check(`${key}: styleKit「${kitKey}」が実在する`, STYLE_KIT_KEYS.includes(kitKey), STYLE_KIT_KEYS.join(" "));

    // ⚠️ 実測で踏んだ衝突。地紋（data-ornament）と常時アニメ（data-ambient）の規則は
    // `html:not([data-reveal="none"])[data-ambient="float"] .ornament` のように詳細度 (0,3,1) で、
    // キット側の素の `.ornament`(0,1,0) や `html:not(…) .ornament`(0,2,1) には決して負けない。
    // 同じ層を奪い合うと、キットの絵と動きが「なぜか出ない」という形で黙って消える。
    // 詳細度の競り合いをするより、「キットが .ornament を使うなら両方 none」と決めるほうが安い。
    const kit = STYLE_KITS[kitKey];
    if (kit && /(^|[\s,{])\.ornament\b/.test(kit.css)) {
      check(
        `${key}: .ornament を描くキットなので ornament は "none"`,
        file.design.layout.ornament === "none",
        file.design.layout.ornament
      );
      check(
        `${key}: .ornament を描くキットなので ambient は "none"`,
        file.design.animation.ambient === "none",
        file.design.animation.ambient
      );
    }
  }

  clinicNames.add(file.meta.clinicName);
}

// ── 3. テンプレートどうしが違って見えるか ────────────────────────────────────────────────────────
// ⚠️ この Phase の目的そのもの。「全部同じに見える」を機械的に測れる範囲で押さえる。
console.log("\n3. テンプレートどうしが違うか");
{
  const files = TEMPLATE_KEYS.map((k) => TEMPLATES[k]);
  const distinct = <T,>(pick: (f: (typeof files)[number]) => T) => new Set(files.map(pick)).size;
  check("架空の医院名が全部違う", clinicNames.size === files.length, [...clinicNames].join(" / "));
  check("配色が全部違う", distinct((f) => f.design.colors.primary) === files.length, files.map((f) => f.design.colors.primary).join(" "));
  check("地紋が全部違う", distinct((f) => f.design.layout.ornament) === files.length, files.map((f) => f.design.layout.ornament).join(" "));
  check(
    "ヘッダーとフッターの組み合わせが全部違う",
    distinct((f) => `${f.design.chrome.header}/${f.design.chrome.footer}`) === files.length,
    files.map((f) => `${f.design.chrome.header}/${f.design.chrome.footer}`).join(" ")
  );
  // 見出しが全テンプレートで同じだと、色が違っても「同じページ」に見える。
  const heroHeadlines = files.map((f) => {
    const hero = f.blocks.find((b) => b.type === "hero");
    return hero && hero.type === "hero" ? hero.data.headline : "";
  });
  check("ヒーローの見出しが全部違う", new Set(heroHeadlines).size === files.length, heroHeadlines.join(" / "));
}

// ── 4. そのまま保存して描けるか ─────────────────────────────────────────────────────────────────
console.log("\n4. ドキュメントとして成立しているか");
for (const key of TEMPLATE_KEYS) {
  const doc = toDocument(TEMPLATES[key], `verify-${key}`);
  // outDir は渡さない — 画像ファイルの実在はここでは見ない（seed 前なので当然まだ無い）。
  const issues = checkDesign(doc).issues.filter((i) => i.severity === "high");
  check(`${key}: checkDesign の HIGH がゼロ`, issues.length === 0, issues.map((i) => `${i.code} ${i.location}`).join(" / "));

  // ⚠️ 「言葉が書かれていない」を確実に捕まえる。JSON を手で書くと必ずどこかを空のまま残す。
  // 見出しが任意のブロック（freeText など）は除く — 見出しの無い自由文は、区切りとして正しい形。
  // 判定はレジストリの `optional` を読む（designCheck の requiredHeadingOf と同じ規則）。
  const empty = doc.blocks.filter((b) => {
    if (b.type === "hero") return !b.data.headline.trim();
    const field = BLOCK_DEFINITIONS[b.type].fields.find((f) => f.key === "heading");
    if (!field || ("optional" in field && field.optional)) return false;
    return !String((b.data as Record<string, unknown>).heading ?? "").trim();
  });
  check(`${key}: 見出しが空のブロックが無い`, empty.length === 0, empty.map((b) => b.id).join(", "));

  const bodyless = doc.blocks.filter((b) => b.type === "rich" && !b.data.body.trim() && b.data.cards.length === 0);
  check(`${key}: 中身の無い文章セクションが無い`, bodyless.length === 0, bodyless.map((b) => b.id).join(", "));

  // ⚠️ 複数ページのテンプレート固有の落とし穴。ナビにはページのリンクとそのページ内のアンカーが
  // 並ぶので、ページ名と同じ navLabel のセクションがあると、同じ言葉のリンクが2つ出る。読み手には
  // どちらを押せばいいのか分からない。実際に描かれる navItems() で測る。
  for (const page of doc.pages) {
    const labels = navItems(doc, page.id).map((item) => item.label).filter((l) => l.trim().length > 0);
    check(
      `${key}: ${page.navLabel || "トップ"} のナビに同じ名前が2つ無い`,
      new Set(labels).size === labels.length,
      labels.join(" / ")
    );
  }
}

// ── 5. 借りた骨格が呼び出し側を汚さないか ────────────────────────────────────────────────────────
console.log("\n5. 骨格を借りても定義が壊れないか");
{
  const key = TEMPLATE_KEYS[0];
  const first = templateLayout(key);
  (first.blocks[0].data as { headline?: string }).headline = "__mutated__";
  const second = templateLayout(key);
  check(
    "取り出した骨格を書き換えても、次に取り出したものは無傷",
    (second.blocks[0].data as { headline?: string }).headline !== "__mutated__"
  );
  check("既定データの型定義と噛み合っている", BLOCK_DEFINITIONS[second.blocks[0].type] !== undefined);
}

// ── 6. スタイルキットが安全規則を守っているか ────────────────────────────────────────────────────
// キットのCSSは site.css の後に読まれるので、書き方しだいで何でも壊せる。壊れ方が「特定の画面幅で
// だけ」「特定の設定の人にだけ」なので、目視では見つからない。ここで機械的に押さえる。
// ⚠️ 文字列一致なので賢くはない。賢くする必要も無い — 禁じ手を「うっかり書いた」を捕まえるのが
// 目的で、迂回しようと思えばできることは分かっている。書いた本人への注意書きとして働けばよい。
console.log("\n6. スタイルキットの安全規則");
for (const key of STYLE_KIT_KEYS) {
  const kit = STYLE_KITS[key];
  const css = kit.css;

  // モバイルメニューは `.nav-toggle:checked ~ nav.site-nav` という隣接兄弟の仕掛けで動く。
  // ヘッダーを浮かせる／nav を動かすと、そのテンプレートから作られる全サイトの全ページでメニューが死ぬ。
  check(
    `${key}: モバイルメニューの仕掛けに触れていない`,
    !/nav-toggle|\.site-nav|\.site-header\s*\{[^}]*position/.test(css)
  );
  // 390px の横スクロールに戻る道は、実測ではこの2つだけだった。
  check(`${key}: 100vw を使っていない`, !/\b100vw\b/.test(css));
  check(`${key}: 負のマージンを使っていない`, !/margin[a-z-]*:\s*-/.test(css));
  // 動くものを書いたなら、動きを望まない人への出口が要る。⚠️ 冒頭の一括指定（animation-duration:
  // 0.01ms）は JS が書いた値も background-attachment も止められないので、キット側の明示が必要。
  if (/@keyframes|animation:/.test(css)) {
    check(`${key}: prefers-reduced-motion の逃げ道がある`, /prefers-reduced-motion/.test(css));
  }
  // 文字の入る箱を動かしていないか。.card / .btn の :hover は静止時のレイアウトを変えないので許す。
  const movesText = /\.(section-inner|card|lead|hero-copy|site-header)\b[^{]*\{[^}]*(animation|transform)\s*:/.test(
    css.replace(/:hover[^{]*\{[^}]*\}/g, "")
  );
  check(`${key}: 静止状態で文字の箱を動かしていない`, !movesText);

  if (kit.js) {
    // インラインではなく js/kit.js に書き出すので実害は無いが、将来インライン化したときに壊れる。
    check(`${key}: JSに </script> が無い`, !kit.js.includes("</script"));
    check(`${key}: JSも動きの設定を見ている`, /prefers-reduced-motion/.test(kit.js));
  }
}

console.log(failures === 0 ? "\n✅ すべて期待どおりです。" : `\n⛔ ${failures} 件が期待と異なります。`);
process.exit(failures === 0 ? 0 : 1);
