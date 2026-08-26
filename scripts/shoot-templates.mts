// Photographs the rendered templates for the public landing page. No AI, no cost.
//
//   npx tsx scripts/shoot-templates.mts
//
// The landing page sells "the homepage you will get", so the pictures on it have to BE that homepage.
// Rather than asking an image model to imagine a clinic website — which produces a plausible-looking
// lie, with fake Japanese and a layout this app cannot actually build — this opens each template's
// real index.html in a real browser and takes a real screenshot.
//
// It also records, for every screenshot, where each section starts as a fraction of the full page
// height. That is what lets the landing page's device mockup scroll to "04 スタッフ紹介" when the
// reader clicks it: the numbers are measured from the actual render, so they cannot drift out of
// step with it the way hand-written offsets would.
//
// Output (all committed, all static — the landing page never touches D1 for this):
//   public/landing/templates/<id>-desktop.jpg
//   public/landing/templates/<id>-mobile.jpg
//   public/landing/templates.json
//
// Env is read before anything under src/ is imported: src/lib/d1.ts captures the Cloudflare
// credentials at module scope, so a static import here would bind them to undefined.
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "landing", "templates");
const MANIFEST = path.join(ROOT, "public", "landing", "templates.json");

/** Wide enough that the templates lay out at their desktop breakpoint, narrow enough that the JPEG
 * of a ~6000px-tall page stays a sane size for a landing page to load. */
const DESKTOP = { width: 1360, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Device pixel ratio per shot — both 1, deliberately. These pages are 7000-9000 CSS pixels tall, so
 * every extra factor of scale multiplies a JPEG that a landing page has to download. At the size the
 * mockups are actually displayed (a laptop frame ~600px wide, a phone frame ~230px wide) 1360 and 390
 * source pixels are already more than a 2x screen resolves; shooting at 2x quadrupled the bytes for
 * no visible difference. */
const SCALE = { desktop: 1, mobile: 1 } as const;

/** A section whose heading is empty (a free-text block) or is template placeholder copy would show
 * up in the landing page's section list as a blank or as "ここにキャッチコピーが入ります". These are
 * the names of the sections as a clinic owner would describe them. */
const SECTION_LABELS: Record<string, string> = {
  hero: "トップ",
  philosophy: "医院の理念",
  news: "お知らせ",
  department: "診療案内",
  greeting: "ご挨拶",
  hours: "診療時間",
  features: "当院の特徴",
  gallery: "院内のご案内",
  staff: "スタッフ紹介",
  pricing: "料金表",
  faq: "よくある質問",
  access: "アクセス",
  contact: "お問い合わせ",
};

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

await loadEnv();

const { chromium } = await import("playwright");
const { listTemplates, getDocument } = await import("../src/lib/site/store");
const { siteOutputPath } = await import("../src/lib/render/renderSiteFiles");

/** Where a section starts, as a fraction of the whole page's height — measured once per device,
 * because a page that is 9,000px tall on a desktop is 14,600px tall on a phone and its sections do
 * not sit at the same fractions of the two. One shared ratio put the landing page's phone mockup
 * several sections away from the one the reader had asked for. */
type SectionMark = { id: string; label: string; ratios: { desktop: number; mobile: number } };
type Shot = { src: string; width: number; height: number };
type Entry = {
  id: string;
  name: string;
  mood: string;
  tags: string[];
  previewUrl: string;
  desktop: Shot;
  mobile: Shot;
  sections: SectionMark[];
};

const summaries = await listTemplates({ sellableOnly: true });
if (summaries.length === 0) {
  console.error("販売可のテンプレートが1件もありません。");
  process.exit(2);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const entries: Entry[] = [];
let failed = 0;

for (const summary of summaries) {
  const doc = await getDocument(summary.id);
  if (!doc) {
    console.error(`⛔ ${summary.id}: ドキュメントが読めません。`);
    failed++;
    continue;
  }

  const { outDir, previewUrl } = siteOutputPath(doc);
  const fileUrl = pathToFileURL(path.join(outDir, "index.html")).href;

  try {
    const shots: Record<"desktop" | "mobile", Shot> = {} as never;
    const ratios: Record<"desktop" | "mobile", Map<string, number>> = {
      desktop: new Map(),
      mobile: new Map(),
    };
    let sections: SectionMark[] = [];

    for (const [key, viewport] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ] as const) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: SCALE[key] });
      await page.goto(fileUrl, { waitUntil: "networkidle" });

      // Every generated site hides its sections until they scroll into view, and a full-page
      // screenshot does not scroll — so without this, most of the picture comes out blank. The
      // reveal CSS is all written as `html.js .reveal`, so dropping that one class turns the whole
      // system off at once and leaves the finished state on screen.
      await page.evaluate(() => {
        document.documentElement.classList.remove("js");
      });
      await page.waitForTimeout(400);

      // Anonymous, with no named inner functions: tsx compiles with esbuild's `keepNames`, which
      // injects a `__name(...)` helper call into every named function it emits. That helper does not
      // exist inside the browser, so a named function here dies with "__name is not defined".
      const measured = await page.evaluate(() => {
        const height = document.documentElement.scrollHeight;
        const marks: { id: string; label: string; ratio: number }[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("section[id]"))) {
          const heading = el.querySelector("h1, h2");
          const label = (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
          marks.push({
            id: el.id,
            label: label.slice(0, 24),
            ratio: Math.min(1, Math.max(0, (el.offsetTop || 0) / Math.max(1, height))),
          });
        }
        return { height, width: document.documentElement.clientWidth, marks };
      });

      const file = `${doc.id}-${key}.jpg`;
      await page.screenshot({
        path: path.join(OUT_DIR, file),
        fullPage: true,
        type: "jpeg",
        quality: 72,
      });

      shots[key] = { src: `/landing/templates/${file}`, width: measured.width, height: measured.height };
      for (const mark of measured.marks) ratios[key].set(mark.id, mark.ratio);
      if (key === "desktop") {
        sections = measured.marks.map((mark) => ({
          id: mark.id,
          // The template's own heading is the honest label, but it is sample copy — fall back to the
          // curated name whenever it is empty or is obviously placeholder text.
          label: SECTION_LABELS[mark.id] ?? (mark.label || mark.id),
          ratios: { desktop: mark.ratio, mobile: mark.ratio },
        }));
      }

      await page.close();
    }

    for (const mark of sections) {
      mark.ratios.desktop = ratios.desktop.get(mark.id) ?? mark.ratios.desktop;
      mark.ratios.mobile = ratios.mobile.get(mark.id) ?? mark.ratios.desktop;
    }

    entries.push({
      id: doc.id,
      name: doc.name,
      mood: doc.mood ?? "",
      tags: doc.tags ?? [],
      previewUrl,
      desktop: shots.desktop,
      mobile: shots.mobile,
      sections,
    });
    console.log(`✅ ${doc.name} — ${sections.length} セクション / 高さ ${shots.desktop.height}px`);
  } catch (err) {
    failed++;
    console.error(`⛔ ${doc.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

await browser.close();

await writeFile(MANIFEST, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");
console.log(`\n${entries.length} 件を撮影しました → ${path.relative(ROOT, MANIFEST)}`);
process.exit(failed > 0 ? 1 : 0);
