import { pathToFileURL } from "url";
import path from "path";
import type { DesignIssue } from "./designCheck";

/** Opens a rendered site in a real browser and measures it.
 *
 * designCheck.ts can tell that a document is self-consistent; it cannot tell that the page built from
 * that document fits on a phone. Every rule here is one that was previously verified by hand, once,
 * and then forgotten — horizontal scroll, broken images, a hero bleeding into the next section,
 * booking buttons that came out different widths. Codifying them is the only way they stay fixed.
 *
 * Playwright is a devDependency and is imported dynamically on purpose: nothing in the running app
 * may depend on it, and `output: "standalone"` must not try to trace it into the deployment bundle.
 * Only scripts/check-design.mts calls this. */

export type Viewport = { name: string; width: number; height: number };

/** 390px is the iPhone 14/15 logical width — the narrowest device this is ever demoed on, and where
 * every layout defect found so far showed up first. 1280 is the desktop the templates were drawn at. */
export const VIEWPORTS: Viewport[] = [
  { name: "スマートフォン(390px)", width: 390, height: 844 },
  { name: "PC(1280px)", width: 1280, height: 800 },
];

/** What the in-page measurement returns. Declared here rather than inferred from the browser function
 * because that function has to stay anonymous and inline — see the note at its call site. */
type Measurements = {
  scrollWidth: number;
  innerWidth: number;
  /** Whether the reader can actually scroll sideways — the thing that matters, as opposed to whether
   * some clipped content technically extends past the viewport. */
  canScrollHorizontally: boolean;
  brokenImages: { src: string; field: string; blockId: string }[];
  overflowing: { tag: string; className: string; text: string; scrollWidth: number; clientWidth: number }[];
  ctaGroups: { widths: number[] }[];
  heroOverlap: number;
};

function issuesFrom(viewport: Viewport, m: Measurements, pageLabel = ""): DesignIssue[] {
  const issues: DesignIssue[] = [];
  // Without the page name a multi-page finding says only "スマートフォン(390px) / ページ全体", which
  // is the one thing the reader needs and cannot get anywhere else.
  const at = (what: string) => `${viewport.name}${pageLabel ? ` / ${pageLabel}` : ""} / ${what}`;

  // Deliberately keyed on real scrollability rather than on scrollWidth. `overflow-x: clip` leaves
  // scrollWidth reporting the un-clipped width forever, so a page that is correctly clipped would
  // otherwise be reported as broken on every run — and a check that always fails gets ignored.
  if (m.canScrollHorizontally) {
    issues.push({
      code: "render-horizontal-scroll",
      location: at("ページ全体"),
      reason: `横幅が${m.scrollWidth}pxあり、画面(${m.innerWidth}px)からはみ出しています。左右にスクロールできてしまいます。`,
      suggestion: "はみ出している要素（下の指摘を参照）の幅か余白を見直してください。",
      severity: "high",
    });
  }

  for (const img of m.brokenImages) {
    issues.push({
      code: "render-broken-image",
      location: at(img.field ? `${img.blockId} / ${img.field}` : "画像"),
      reason: `「${img.src}」が読み込めません。ページには空白が出ます。`,
      suggestion: "画像を差し替えるか、サイトを作り直してください。",
      severity: "high",
    });
  }

  for (const el of m.overflowing) {
    issues.push({
      code: "render-overflow",
      location: at(`${el.tag}.${el.className || "(class無し)"}`),
      reason: `中身の幅が${el.scrollWidth}px、入れ物が${el.clientWidth}pxで、内容が切れています。${el.text ? `該当箇所:「${el.text}」` : ""}`,
      suggestion: "文字数を減らすか、折り返し（word-break）と横スクロールの指定を見直してください。",
      severity: "medium",
    });
  }

  // Only checked on a narrow viewport: that is where the buttons stack vertically and a width
  // mismatch reads as a defect. Side by side on desktop they are meant to size to their own labels.
  if (viewport.width < 560) {
    for (const group of m.ctaGroups) {
      if (group.widths.length > 1 && new Set(group.widths).size > 1) {
        issues.push({
          code: "render-cta-width-mismatch",
          location: at("予約ボタン"),
          reason: `縦に並んだボタンの幅が揃っていません（${group.widths.join("px / ")}px）。`,
          suggestion: "ボタンを同じ幅に揃えてください。",
          severity: "medium",
        });
      }
    }
  }

  if (m.heroOverlap > 1) {
    issues.push({
      code: "render-hero-overlap",
      location: at("メインビジュアル"),
      reason: `メインビジュアルが次のセクションに${Math.round(m.heroOverlap)}px食い込んでいます。`,
      suggestion: ".hero に overflow: hidden が効いているか、パララックスの移動量を確認してください。",
      severity: "high",
    });
  }

  return issues;
}

/** How long to wait for a page whose head links an external stylesheet before giving up on the
 * network and measuring with system fonts. Generous enough for a slow-but-working connection,
 * short enough that a hung one does not look like a crash. */
const EXTERNAL_BUDGET_MS = 12_000;

/** Set once per process so a multi-page run explains itself once rather than per page per viewport. */
let warnedOffline = false;

/** One HTML file to measure, and the page label to name it by in any finding. */
export type RenderTarget = { path: string; label: string };

/** Measures one page. Kept as the single-target entry point every existing caller already uses. */
export async function checkRenderedSite(indexHtmlPath: string): Promise<DesignIssue[]> {
  return checkRenderedPages([{ path: indexHtmlPath, label: "" }]);
}

/** Launches a browser once and measures every target at every viewport.
 *
 * ⚠️ One browser for ALL pages, not one per page. The launch is by far the most expensive part of
 * this check — a six-page site would otherwise pay for six cold Chromium starts to measure six files
 * that are each a few hundred milliseconds of work.
 *
 * Falls back to the locally installed Chrome when Playwright's own Chromium hasn't been downloaded —
 * `npx playwright install chromium` needs network access that a CI box or a locked-down machine may
 * not have, and having the check refuse to run is worse than running it in a slightly different
 * browser. Throws only when neither is available, so the caller can say so plainly. */
export async function checkRenderedPages(targets: RenderTarget[]): Promise<DesignIssue[]> {
  if (targets.length === 0) return [];
  const { chromium } = await import("playwright");

  let browser;
  try {
    browser = await chromium.launch();
  } catch (bundledError) {
    try {
      browser = await chromium.launch({ channel: "chrome" });
    } catch {
      throw new Error(
        `ブラウザを起動できませんでした。\`npx playwright install chromium\` を実行してください。\n${
          bundledError instanceof Error ? bundledError.message.split("\n")[0] : String(bundledError)
        }`
      );
    }
  }

  const issues: DesignIssue[] = [];
  try {
    for (const target of targets) {
      issues.push(...(await measureOne(browser, target)));
    }
  } finally {
    await browser.close();
  }
  return issues;
}

async function measureOne(
  browser: Awaited<ReturnType<Awaited<typeof import("playwright")>["chromium"]["launch"]>>,
  target: RenderTarget
): Promise<DesignIssue[]> {
  const url = pathToFileURL(path.resolve(target.path)).href;
  const issues: DesignIssue[] = [];
  {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      // "load" would wait on every subresource, including the Google Fonts stylesheet a template may
      // reference — which never resolves on a machine without outbound network and timed the whole
      // check out. Waiting for it separately, and shrugging if it never comes, keeps the check usable
      // offline at the cost of measuring with fallback fonts.
      //
      // ⚠️ `domcontentloaded` is NOT enough on its own: a <link rel=stylesheet> in the head is
      // render-blocking, so DOMContentLoaded itself waits on the Google Fonts request. A network that
      // FAILS is fine (the request errors immediately); a network that HANGS — a captive portal, a
      // flaky uplink, DNS black-holing — stalls the whole check with a bare 30-second navigation
      // timeout that names no page and no cause. Measured: that is exactly what happened.
      //
      // So the first attempt is given a short budget, and a timeout retries with every non-local
      // request blocked. The fallback measures with system fonts, which is the same trade this
      // function already accepts when there is no network at all — and it says so, rather than
      // failing.
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: EXTERNAL_BUDGET_MS });
      } catch {
        await page.route("**/*", (route) =>
          route.request().url().startsWith("file://") ? route.continue() : route.abort()
        );
        await page.goto(url, { waitUntil: "domcontentloaded" });
        if (!warnedOffline) {
          warnedOffline = true;
          console.warn(
            "[renderCheck] 外部リソース（Google Fonts など）の読み込みが終わらないため、" +
              "以降はシステムフォントで計測します。文字幅がわずかに変わるため、はみ出しの判定が実際より甘くなることがあります。"
          );
        }
      }
      await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
      // Web fonts change every text measurement, and a page measured mid-swap reports overflow that
      // is gone a moment later. (`.then(() => undefined)` because the FontFaceSet itself is not
      // serializable back across the bridge.)
      await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});

      // Every section starts at opacity 0 behind an IntersectionObserver, so a page measured as
      // loaded is a page where nothing has appeared yet. Jumping straight to the bottom would leave
      // the middle sections un-revealed — the observer never sees them intersect — so this walks
      // down a screen at a time, which is what a reader does anyway.
      await page.evaluate(async () => {
        const step = Math.max(200, window.innerHeight * 0.8);
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo({ top: y, behavior: "instant" });
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      // Long enough for the slowest reveal the schema allows (2000ms) to finish.
      await page.waitForTimeout(2200);

      // Horizontal scrollability is read FIRST, while the page is still in its natural state. This is
      // the one rule whose subject is the un-settled page: a section that has not been revealed yet
      // sits translated sideways, and being able to scroll to it is exactly the defect.
      const canScrollHorizontally = await page.evaluate(() => {
        // `behavior: "instant"` is required: site.css sets `scroll-behavior: smooth`, so a plain
        // scrollTo animates and the position read on the next line would still be the old one —
        // making every page look un-scrollable.
        const before = window.scrollX;
        window.scrollTo({ left: before + 120, top: window.scrollY, behavior: "instant" });
        const moved = window.scrollX > before;
        window.scrollTo({ left: before, top: window.scrollY, behavior: "instant" });
        return moved;
      });

      // Everything else is about the settled layout, so the entrance animations are switched off
      // before measuring. Without this, any element the observer had not reached yet still carries
      // its starting `translateX(±40px)` and reports as overflowing its container — which produced a
      // different, contradictory set of findings on every run.
      // `transition: none` is as important as the transform reset: .reveal transitions transform over
      // up to 2000ms, so merely setting `transform: none` starts an animation and anything measured
      // before it lands is measured mid-flight. That was the source of a 6px card-grid "overflow"
      // that appeared on a different document on every run.
      await page.addStyleTag({
        content:
          ".reveal, .reveal * { transform: none !important; opacity: 1 !important; filter: none !important; }" +
          "*, *::before, *::after { transition: none !important; animation: none !important; }",
      });
      await page.waitForTimeout(150);

      // The measurement function is written inline and anonymous, and declares no named inner
      // functions, on purpose. This file is run through tsx (esbuild), whose `keepNames` transform
      // wraps every *named* function in a `__name(...)` helper — which is defined in the Node process,
      // not in the page, so a named function serialized into the browser dies with
      // "ReferenceError: __name is not defined". An anonymous arrow passed straight as an argument
      // gets no such wrapper. Keep it that way; the `Measurements` type above is the contract.
      const measurements = (await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,

          brokenImages: Array.from(document.images)
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => ({
              src: img.getAttribute("src") ?? "",
              field: img.getAttribute("data-field") ?? "",
              blockId: img.getAttribute("data-block-id") ?? "",
            })),

          overflowing: Array.from(document.querySelectorAll<HTMLElement>(".section-inner *"))
            .filter((el) => el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0)
            .slice(0, 5)
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              className: typeof el.className === "string" ? el.className : "",
              text: (el.textContent ?? "").trim().slice(0, 30),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            })),

          // Buttons inside one CTA group are meant to read as a set; different widths look like a bug.
          ctaGroups: Array.from(document.querySelectorAll<HTMLElement>(".cta-buttons")).map((group) => ({
            widths: Array.from(group.querySelectorAll<HTMLElement>(".btn")).map(
              (b) => Math.round(b.getBoundingClientRect().width * 10) / 10
            ),
          })),

          heroOverlap: (() => {
            const hero = document.querySelector<HTMLElement>(".hero");
            const afterHero = hero?.nextElementSibling as HTMLElement | null;
            if (!hero || !afterHero) return 0;
            return (
              Math.round((hero.getBoundingClientRect().bottom - afterHero.getBoundingClientRect().top) * 10) / 10
            );
          })(),
        };
      })) as Omit<Measurements, "canScrollHorizontally">;

      issues.push(...issuesFrom(viewport, { ...measurements, canScrollHorizontally }, target.label));
      await page.close();
    }
  }
  return issues;
}
