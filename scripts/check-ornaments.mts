// Proves the decorative layer: that it draws, that it moves only where it is allowed to, and that it
// cannot break the page it decorates.
//
//   npx tsx scripts/check-ornaments.mts          # 検査して片付ける
//   npx tsx scripts/check-ornaments.mts --keep   # 目視用に残す（/generated/__orn-*/）
//
// No AI, no D1, no credentials, no cost. The documents are built in memory and rendered straight to
// disk — renderSiteFiles needs nothing but the object — so this is safe to run on every change.
//
// ⚠️ The first half is the important half. A decoration that looks right in one browser at one width
// is not the property being defended here; the properties are "it cannot overflow", "it cannot cover
// a link", and "a template that asked for silence gets silence". Those are structural, so they are
// asserted against the CSS and the markup rather than eyeballed.
import { readFile, rm } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const keep = process.argv.includes("--keep");

const { buildDefaultTemplate } = await import("../src/lib/site/defaultTemplate");
const { applySampleCopy } = await import("../src/lib/template/sampleCopy");
const { createBlock } = await import("../src/lib/site/blocks");
const { renderSiteHtml } = await import("../src/lib/render/renderSiteHtml");
const { renderSiteFiles, siteOutputPath } = await import("../src/lib/render/renderSiteFiles");
const { checkRenderedPages } = await import("../src/lib/site/renderCheck");
const { documentImageSlots, BACKDROP_SLOT, LOGO_SLOT } = await import("../src/lib/site/imagePaths");
const { decorationFor, fillMissingDecoration } = await import("../src/lib/site/decoration");
const { applyImagePaths } = await import("../src/lib/siteGenerator");
const { DEFAULT_DESIGN_TOKENS } = await import("../src/lib/site/document");
import type { DesignTokens, SiteDocument } from "../src/lib/site/document";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${ok || detail === undefined ? "" : `\n       ${String(detail).slice(0, 300)}`}`);
}

const ORNAMENTS: DesignTokens["layout"]["ornament"][] = ["seigaiha", "asanoha", "dots-fine", "hairlines", "arc"];
const AMBIENTS: DesignTokens["animation"]["ambient"][] = ["drift", "float", "sheen", "none"];

/** A page with something of everything the decorative layer has to survive: a tinted section, a
 * table, a photo grid and the scrolling strip. */
function buildDoc(name: string, tweak: (design: DesignTokens) => void): SiteDocument {
  const doc = buildDefaultTemplate();
  // ⚠️ 素の既定値に戻してから測る。テンプレートが JSON になった時点で buildDefaultTemplate() は
  // 「標準テンプレート」＝地紋も常時アニメも持つドキュメントを返すようになった。この検査が見たいのは
  // 「何も指定していないドキュメントには何も足されない」なので、土台は既定値でなければならない。
  doc.design = structuredClone(DEFAULT_DESIGN_TOKENS);
  doc.slug = `__orn-${name}`;
  doc.name = `装飾確認 ${name}`;
  doc.isTemplate = false;
  doc.canSell = false;
  doc.mood = undefined;
  // renderSiteFiles ships images/placeholder.svg into every output directory and nothing else, so a
  // template pointing at images/logo.png would report a missing file that has nothing to do with
  // what is being tested here.
  doc.meta.logoImage = "images/placeholder.svg";
  doc.blocks = applySampleCopy([
    createBlock("hero", { id: "hero", navLabel: "" }),
    createBlock("rich", { id: "rich", navLabel: "診療案内", cardCount: 3 }),
    createBlock("hours", { id: "hours", navLabel: "診療時間" }),
    createBlock("gallery", { id: "gallery", navLabel: "院内", variant: "marquee" } as never),
    createBlock("freeText", { id: "free", navLabel: "" }),
    createBlock("contact", { id: "contact", navLabel: "お問い合わせ" }),
  ]);
  tweak(doc.design);
  return doc;
}

// ── 1. 安全規則が CSS に書かれているか ────────────────────────────────────────────────────────────
// ⚠️ 目視では絶対に見つからない種類の不具合を、機械的に押さえる場所。
console.log("1. 安全規則（site.css を機械的に読む）");
{
  const css = await readFile(path.join(ROOT, "src/lib/render/site.css"), "utf-8");

  const ornamentRule = css.match(/^\.ornament\s*\{([^}]*)\}/m)?.[1] ?? "";
  check("装飾レイヤーは absolute + inset:0", /position:\s*absolute/.test(ornamentRule) && /inset:\s*0/.test(ornamentRule), ornamentRule);
  check("装飾レイヤーは操作を奪わない（pointer-events:none）", /pointer-events:\s*none/.test(ornamentRule), ornamentRule);

  // 「はみ出させる」指定が装飾に紛れ込んでいないか。負のマージンは 390px の横スクロールを呼び戻す唯一の道。
  const ornamentBlock = css.slice(css.indexOf("/* 地紋・背景写真・常時アニメ"));
  check("装飾に負のマージンが無い", !/margin(-\w+)?:\s*-/.test(ornamentBlock), ornamentBlock.match(/margin(-\w+)?:\s*-[^;]*/)?.[0]);

  // ⚠️ これが Phase 3 の中心的な約束。data-ambient を読む規則は、必ず data-reveal="none" を除外する。
  const ambientSelectors = ornamentBlock
    .split("\n")
    .filter((line) => line.includes("[data-ambient=") && !line.trim().startsWith("*"));
  check("常時アニメの規則が存在する", ambientSelectors.length >= 3, ambientSelectors.length);
  const unguarded = ambientSelectors.filter((line) => !line.includes(':not([data-reveal="none"])'));
  check("常時アニメは全て data-reveal=\"none\" を除外している", unguarded.length === 0, unguarded.join(" | "));

  check("スクリムの色が定義されている", /--backdrop-scrim:\s*color-mix/.test(css), "");
}

// ── 2. 既定値のままなら、何も増えない ────────────────────────────────────────────────────────────
console.log("\n2. 既定値のドキュメントに影響が無いか");
{
  const plain = buildDoc("plain", () => {});
  const html = await renderSiteHtml(plain);
  check('装飾レイヤーの要素が出ない', !html.includes('class="ornament"'), "");
  check("読み進みバーが出ない", !html.includes("scroll-progress"), "");
  check('背景写真は none', html.includes('data-backdrop="none"'), "");
  check('地紋は none', html.includes('data-ornament="none"'), "");
  check("背景写真の <style> が出ない", !html.includes("--backdrop-scrim)"), "");
}

// ── 3. 有効にしたときだけ増える ──────────────────────────────────────────────────────────────────
console.log("\n3. 有効にしたときの出力");
{
  const on = buildDoc("on", (d) => {
    d.layout.ornament = "seigaiha";
    d.animation.ambient = "drift";
    d.animation.progressBar = true;
    d.layout.backdrop = "page";
    d.layout.backdropImage = "images/placeholder.svg";
  });
  const html = await renderSiteHtml(on);
  // ⚠️ `class="section-inner`, not `class="section`: the latter also matches section-inner and
  // would count every section twice. One section-inner is emitted per Section(), which is exactly
  // the set that gets an ornament (the hero renders its own <section> and takes none).
  const sections = (html.match(/class="section-inner/g) ?? []).length;
  const ornaments = (html.match(/class="ornament"/g) ?? []).length;
  check("セクションの数だけ装飾レイヤーが出る", ornaments === sections && ornaments > 0, `${ornaments} / ${sections}`);
  check("読み進みバーが出る", html.includes('class="scroll-progress"'), "");
  check('data-ambient が渡る', html.includes('data-ambient="drift"'), "");
  // ⚠️ ドキュメント側の <style> に、パスがそのまま書かれていること。site.css 経由（css/ が基準に
  // なる）だと写真が黙って出なくなる — 実測で見つけた不具合なので、ここで固定する。
  check("背景写真の規則がページ内に出る", html.includes('url("images/placeholder.svg")'), "");
  check("背景写真にスクリムが重なる", html.includes("linear-gradient(var(--backdrop-scrim), var(--backdrop-scrim))"), "");
  check("動きを控える設定で固定が外れる", html.includes("prefers-reduced-motion: reduce),(max-width:767px)"), "");

  // ⚠️ 写真がまだ無いのに背景を有効にしても、薄い膜だけが出るような状態にはしない。
  const noImage = buildDoc("noimg", (d) => {
    d.layout.backdrop = "page";
    d.layout.backdropImage = "";
  });
  check("写真が無い間は背景の指定ごと無効になる", (await renderSiteHtml(noImage)).includes('data-backdrop="none"'), "");
}

// ── 4. 流れる写真の帯が、編集画面を壊さないか ────────────────────────────────────────────────────
console.log("\n4. 流れる写真の帯（marquee）");
{
  const doc = buildDoc("marquee", (d) => {
    d.layout.ornament = "dots-fine";
  });
  const html = await renderSiteHtml(doc);
  check("2周目の複製が出ている", html.includes('class="marquee-copy"'), "");
  // ⚠️ data-field が二重になると、編集画面は片方しか更新しない（クリックで選ぶ join がこの属性）。
  const fieldCounts = new Map<string, number>();
  for (const m of html.matchAll(/data-field="(images\.\d+\.src)"/g)) {
    fieldCounts.set(m[1], (fieldCounts.get(m[1]) ?? 0) + 1);
  }
  const duplicated = [...fieldCounts.entries()].filter(([, n]) => n > 1);
  check("複製に data-field が付いていない（編集画面の対応付けが一意）", duplicated.length === 0, JSON.stringify(duplicated));
  check("複製は支援技術から隠されている", /class="marquee-copy"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*class="marquee-copy"/.test(html), "");
}

// ── 5. 背景写真が画像の台帳に載るか ──────────────────────────────────────────────────────────────
console.log("\n5. 背景写真が画像の台帳（imagePaths）に載るか");
{
  const off = buildDoc("slot-off", () => {});
  check("背景なしのときスロットは出ない", !documentImageSlots(off).some((s) => s.slot === BACKDROP_SLOT), "");

  const on = buildDoc("slot-on", (d) => {
    d.layout.backdrop = "sections";
  });
  const slots = documentImageSlots(on);
  check("背景ありのときスロットが1つ増える", slots.filter((s) => s.slot === BACKDROP_SLOT).length === 1, slots.map((s) => s.slot).join(","));
  check("ロゴのスロットは変わらず1つ", slots.filter((s) => s.slot === LOGO_SLOT).length === 1);

  // 生成した画像が書き戻ること、生成されなかった場合は消えること（他の全スロットと同じ規則）。
  applyImagePaths(on, new Map([[BACKDROP_SLOT, "images/backdrop.jpg"]]));
  check("生成された背景写真が書き戻る", on.design.layout.backdropImage === "images/backdrop.jpg", on.design.layout.backdropImage);
  applyImagePaths(on, new Map());
  check("生成されなかったら消える（存在しないファイルを指さない）", on.design.layout.backdropImage === "", on.design.layout.backdropImage);
}

// ── 5b. 装飾の自動割り当て ──────────────────────────────────────────────────────────────────────
// ⚠️ ここが「Phase 0〜4 を入れても画面が変わらなかった」ことへの答え。参考サイトを忠実に真似ると
// 既定値（柄なし・動きなし・bar・dark）になるので、装飾はこちらで必ず割り当てる。
console.log("\n5b. 装飾の自動割り当て（decorationFor）");
{
  const seeds = ["t1", "t2", "t3", "t4", "t5"];
  const taken = new Set<string>();
  const chosen = seeds.map((seed) => {
    const d = decorationFor(seed, taken, { hasPhone: true });
    taken.add(d.ornament);
    return d;
  });
  check("5件とも違う地紋になる", new Set(chosen.map((d) => d.ornament)).size === 5, chosen.map((d) => d.ornament).join(","));
  check("地紋が none になることは無い", chosen.every((d) => d.ornament !== "none"));
  check("常に動く（ambient が none にならない）", chosen.every((d) => d.ambient !== "none"), chosen.map((d) => d.ambient).join(","));
  check(
    "濃さは 0.10〜0.22",
    chosen.every((d) => d.ornamentStrength >= 0.1 && d.ornamentStrength <= 0.22),
    chosen.map((d) => d.ornamentStrength).join(",")
  );
  // ⚠️ minimal ヘッダーは .header-tel を消す。医院の電話導線を装飾の都合で落としてはいけない。
  check("電話番号があるテンプレートに minimal ヘッダーを当てない", chosen.every((d) => d.header !== "minimal"));
  check("電話番号が無ければ minimal も候補に入る", ["bar", "stacked", "minimal"].includes(decorationFor("t1", new Set()).header));

  // 決定的であること — 作り直すたびに勝手に化粧が変わってはいけない（derivePalette と同じ約束）。
  check("同じ seed なら何度呼んでも同じ", JSON.stringify(decorationFor("t3", new Set())) === JSON.stringify(decorationFor("t3", new Set())));

  // 軸ごとの上書き。モデルが「柄がある」と答えた軸は残り、既定値のままの軸だけ埋まる。
  const partly = buildDoc("partly", (d) => {
    d.layout.ornament = "arc";
    d.chrome.footer = "band";
  });
  fillMissingDecoration(partly.design, decorationFor("zzz", new Set(), { hasPhone: true }));
  check("モデルが答えた地紋は残る", partly.design.layout.ornament === "arc", partly.design.layout.ornament);
  check("モデルが答えたフッターは残る", partly.design.chrome.footer === "band", partly.design.chrome.footer);
  check("既定値のままのヘッダーは埋まる", partly.design.chrome.header !== "bar", partly.design.chrome.header);

  // ⚠️ 実際に出荷されてしまった状態：ambient があるのに ornament が none。動かす要素が0個になる。
  const bare = buildDoc("bare", (d) => {
    d.animation.ambient = "float";
  });
  const html = await renderSiteHtml(bare);
  check(
    "地紋なしで ambient だけ、という組み合わせは装飾要素を持たない（この状態を作らないのが decorationFor の役目）",
    !html.includes('class="ornament"') && html.includes('data-ambient="float"')
  );
}

// ── 6. 実際に描画して測る ────────────────────────────────────────────────────────────────────────
console.log("\n6. 描画検査（390px / 1280px）");
const built: SiteDocument[] = [];
for (const [index, ornament] of ORNAMENTS.entries()) {
  built.push(
    buildDoc(ornament, (d) => {
      d.layout.ornament = ornament;
      // 既定より濃くして検査する（薄すぎると「出ているのに見えない」不具合を見逃す）。
      d.layout.ornamentStrength = 0.24;
      // 地紋ごとに違う常時アニメを当てて、組み合わせを一巡させる。
      d.animation.ambient = AMBIENTS[index % AMBIENTS.length];
      d.animation.progressBar = true;
      // 半分は背景写真つき。プレースホルダは renderSiteFiles が必ず images/ に置く。
      if (index % 2 === 0) {
        d.layout.backdrop = index % 4 === 0 ? "page" : "sections";
        d.layout.backdropImage = "images/placeholder.svg";
      }
    })
  );
}
// 「静けさを選んだテンプレート」でも崩れないこと（帯は折り返し、地紋は止まる）。
built.push(
  buildDoc("quiet", (d) => {
    d.layout.ornament = "asanoha";
    d.animation.ambient = "drift";
    d.animation.reveal = "none";
    d.animation.duration = 0;
  })
);

const targets: { path: string; label: string }[] = [];
for (const doc of built) {
  const { outDir } = await renderSiteFiles(doc);
  targets.push({ path: path.join(outDir, "index.html"), label: `${doc.design.layout.ornament}/${doc.design.animation.ambient}` });
}
console.log(`  ${built.length} 件を描画しました: ${targets.map((t) => t.label).join(", ")}`);

const issues = await checkRenderedPages(targets);
if (issues.length === 0) {
  console.log("  ✅ 横スクロール・画像切れ・はみ出しはありません。");
} else {
  failures += issues.length;
  for (const issue of issues) console.log(`  ⛔ [${issue.severity}] ${issue.location}\n     ${issue.reason}`);
}

if (keep) {
  console.log(`\n--keep: /generated/__orn-*/ に残しました。片付けるには --keep 無しでもう一度実行してください。`);
} else {
  for (const doc of built) await rm(siteOutputPath(doc).outDir, { recursive: true, force: true });
  console.log("\n片付けました。");
}

console.log(failures === 0 ? "\n✅ すべて期待どおりです。" : `\n⛔ ${failures} 件が期待と異なります。`);
process.exit(failures === 0 ? 0 : 1);
