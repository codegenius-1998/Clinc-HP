import { existsSync } from "fs";
import path from "path";
import { BLOCK_DEFINITIONS, blockLabel, blockSummary } from "./blocks";
import { contrastRatio, readableFill } from "./color";
import { effectiveCardLayout } from "./composition";
import { LOGO_SLOT, documentImageSlots, needsGeneratedFile, slotKey } from "./imagePaths";
import { pageBlocks } from "./pages";
import type { Block, PageDef, SiteDocument } from "./document";

/** Checks a site document for the kinds of breakage a person only notices by opening the page.
 *
 * This is the free, instant half of the design check: pure inspection of the document (plus, when an
 * output directory is given, whether the files it points at exist). The other half — actually
 * rendering the page and measuring it — lives in renderCheck.ts, because it needs a browser.
 *
 * It exists because a whole class of defect shipped silently: three of five generated sites carried
 * `images/greeting.jpg` in the document with no such file on disk, and nothing noticed until someone
 * scrolled to ご挨拶 and saw a blank rectangle. Everything here is a rule that would have caught a
 * real defect we have actually hit, not a general-purpose lint — the value is in staying that way.
 *
 * Deliberately shaped like GuidelineIssue (checkGuidelineCompliance.ts) so the editor's modal can
 * render both with the same component. Unlike that one, this makes no AI call and costs nothing. */

export type DesignIssueSeverity = "high" | "medium" | "low";

export type DesignIssue = {
  /** Stable identifier, so scripts and tests can assert on a rule without matching Japanese prose. */
  code: string;
  location: string;
  reason: string;
  suggestion: string;
  severity: DesignIssueSeverity;
};

export type DesignCheckResult = {
  ok: boolean;
  summary: string;
  issues: DesignIssue[];
};

/** Japanese counts by code point, not UTF-16 unit — "𠮷" is one character to a reader. */
function charCount(text: string): number {
  return [...text].length;
}

function blockWhere(block: Block): string {
  return `${blockLabel(block.type)}「${blockSummary(block)}」`;
}

/** The document's heading field — but only when the block registry says the field is required.
 * `freeText` declares its heading optional (it exists to be a bare paragraph between sections), so an
 * empty one there is the intended design rather than a hole. Reading the requirement from
 * BLOCK_DEFINITIONS rather than listing types here means a new block type is covered automatically. */
function requiredHeadingOf(block: Block): string | null {
  const field = BLOCK_DEFINITIONS[block.type].fields.find((f) => f.key === "heading");
  if (!field || ("optional" in field && field.optional)) return null;
  const data = block.data as Record<string, unknown>;
  return typeof data.heading === "string" ? data.heading : null;
}

// --- individual rules ----------------------------------------------------------------------------

/** Colour readability, judged against what the page actually paints.
 *
 * Two different things are checked here, and they are not the same problem:
 *
 *  - **Body text.** `text` on `background` and on `light`. Nothing derives these; if they are too
 *    close, the page is genuinely unreadable, so this is the one colour rule that can be 要修正.
 *  - **Labels on the brand colour** (the navigation bar, the 電話 button). The renderer already
 *    guarantees these by darkening the FILL (`readableFill`, see themeStyle in components.tsx), so
 *    there is nothing for the reader to suffer — but the admin should know their brand colour is
 *    being deepened where text sits on it, because the button will not be the hex they chose.
 *
 * ⚠️ An earlier version of this check compared `accentInverse` against `accent` and reported every
 * template. That pair was never painted: `--accent-inverse` was declared in the schema and used by no
 * CSS rule at all. The nav-hover rule now uses it, which is what makes the comparison meaningful. */
function checkContrast(doc: SiteDocument): DesignIssue[] {
  const c = doc.design.colors;
  const issues: DesignIssue[] = [];

  const bodyPairs: { code: string; fg: string; bg: string; where: string }[] = [
    { code: "contrast-body", fg: c.text, bg: c.background, where: "本文の文字色 × 背景色" },
    { code: "contrast-body-alt", fg: c.text, bg: c.light, where: "本文の文字色 × 交互セクションの背景色" },
  ];
  for (const pair of bodyPairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    if (ratio >= 4.5) continue;
    issues.push({
      code: pair.code,
      location: `配色 / ${pair.where}`,
      reason: `コントラスト比が ${ratio.toFixed(1)}:1 しかありません（${pair.fg} と ${pair.bg}）。読みやすさの目安は 4.5:1 以上です。`,
      suggestion: "文字色を濃くするか、背景色を明るくしてください。",
      severity: ratio < 3 ? "high" : "medium",
    });
  }

  const fillPairs: { fill: string; label: string; where: string; used: string }[] = [
    { fill: c.primary, label: c.primaryInverse, where: "メインカラー", used: "メニューバーと電話ボタン" },
    { fill: c.accent, label: c.accentInverse, where: "アクセントカラー", used: "メニューをマウスで指したとき" },
  ];
  for (const pair of fillPairs) {
    const adjusted = readableFill(pair.fill, pair.label);
    if (adjusted === pair.fill) continue;
    issues.push({
      code: "contrast-fill-adjusted",
      location: `配色 / ${pair.where}`,
      reason:
        `${pair.where}（${pair.fill}）の上に ${pair.label} の文字を置くとコントラスト比が ` +
        `${contrastRatio(pair.fill, pair.label).toFixed(1)}:1 しかないため、${pair.used}では ${adjusted} に自動で濃くしています。`,
      suggestion: `この色のままで良ければ対応は不要です。指定どおりの色で出したい場合は、文字色（${pair.label}）のほうを変えてください。`,
      severity: "low",
    });
  }

  return issues;
}

function isHeroSlot(doc: SiteDocument, slot: string): boolean {
  return doc.blocks.some((b) => b.type === "hero" && slotKey(b.id) === slot);
}

/** The BUG-01 rule. `outDir` is where renderSiteFiles wrote this document; without it the file half
 * of the check is skipped and only empty slots are reported (the editor calls it that way while
 * there are unsaved changes, since the files on disk are a save behind). */
function checkImages(doc: SiteDocument, outDir?: string): DesignIssue[] {
  const issues: DesignIssue[] = [];

  for (const slot of documentImageSlots(doc)) {
    if (!slot.rendered) continue;

    if (!slot.value) {
      // Most slots are optional by design — a 文章＋カード section with no image renders as a plain
      // text section on purpose, and flagging that would fire on every template. Only the two slots
      // the page is actually built around are reported: the hero (whose whole job is the opening
      // image) and the header logo (which every page shows).
      if (slot.slot === LOGO_SLOT) {
        issues.push({
          code: "image-empty-logo",
          location: slot.label,
          reason: "ロゴが設定されていません。ヘッダーに医院名の文字だけが並びます。",
          suggestion: "ロゴ画像を設定してください。",
          severity: "low",
        });
      } else if (isHeroSlot(doc, slot.slot)) {
        issues.push({
          code: "image-empty-hero",
          location: slot.label,
          reason: "メインビジュアルの画像がありません。最初の画面が背景色だけになります。",
          suggestion: "画像を設定するか、文字だけで成立する構成に変えてください。",
          severity: "medium",
        });
      }
      continue;
    }

    if (!outDir || !needsGeneratedFile(slot.value)) continue;
    if (existsSync(path.join(outDir, slot.value))) continue;

    issues.push({
      code: "image-missing",
      location: slot.label,
      reason: `「${slot.value}」を参照していますが、ファイルが存在しません。ページには画像の代わりに空白が出ます。`,
      suggestion: "画像を差し替えるか、サイトを作り直してください。",
      severity: "high",
    });
  }

  return issues;
}

/** A heading or headline that never got written leaves a visible hole — and in the hero's case, a
 * page whose first screen says nothing at all. */
function checkRequiredText(doc: SiteDocument): DesignIssue[] {
  const issues: DesignIssue[] = [];

  for (const block of doc.blocks) {
    if (!block.visible) continue;

    if (block.type === "hero" && !block.data.headline.trim()) {
      issues.push({
        code: "text-hero-headline",
        location: `${blockLabel(block.type)} / キャッチコピー`,
        reason: "最初の画面に表示される見出しが空です。",
        suggestion: "医院の特徴が一目で伝わる一文を入れてください。",
        severity: "high",
      });
      continue;
    }

    const heading = requiredHeadingOf(block);
    if (heading !== null && !heading.trim()) {
      issues.push({
        code: "text-heading",
        location: `${blockWhere(block)} / 見出し`,
        reason: "セクションの見出しが空です。区切りが分からなくなります。",
        suggestion: "見出しを入れるか、このセクションを非表示にしてください。",
        severity: "medium",
      });
    }
  }

  return issues;
}

/** Structural invariants of a clinic page. `singleton` already declares which block types a page can
 * only sensibly have one of (blocks.ts), so duplicates are detected from that rather than re-listed.
 *
 * ⚠️ Most of these are PER PAGE, and which ones are not is the whole judgement here. "one hero" and
 * "hero first" describe a page; two heroes on two pages is not a defect, it is the point of having
 * pages. "there is a way to contact the clinic" describes the SITE — requiring a contact section on
 * every page would fire on every multi-page site ever built, and a check that always fires is a
 * check people learn to skip. */
function checkStructure(doc: SiteDocument): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const multiPage = doc.pages.length > 1;
  const where = (page: PageDef, what: string) => (multiPage ? `${page.navLabel} / ${what}` : what);

  if (!doc.pages.some((page) => page.path === "")) {
    issues.push({
      code: "structure-no-home",
      location: "ページ構成",
      reason: "トップページ（URLの直下）がありません。サイトを開いても何も表示されません。",
      suggestion: "いずれかのページのURLを空にして、トップページにしてください。",
      severity: "high",
    });
  }

  for (const page of doc.pages) {
    issues.push(...checkPageStructure(doc, page, where));
  }

  if (!doc.blocks.some((b) => b.visible && b.type === "contact")) {
    issues.push({
      code: "structure-no-contact",
      location: "サイト全体",
      reason: "お問い合わせセクションがどのページにもありません。電話・LINEの予約導線が無い状態です。",
      suggestion: "いずれかのページにお問い合わせを追加してください。",
      severity: "medium",
    });
  }

  return issues;
}

function checkPageStructure(
  doc: SiteDocument,
  page: PageDef,
  where: (page: PageDef, what: string) => string
): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const visible = pageBlocks(doc, page.id);
  const isHome = page.path === "";

  if (visible.length === 0) {
    return [
      {
        code: "structure-empty",
        location: where(page, "ページ全体"),
        reason: "表示されるセクションが1つもありません。空白のページになります。",
        suggestion: "いずれかのセクションを表示にするか、このページを削除してください。",
        severity: "high",
      },
    ];
  }

  const counts = new Map<Block["type"], number>();
  for (const block of visible) counts.set(block.type, (counts.get(block.type) ?? 0) + 1);

  for (const [type, count] of counts) {
    if (count > 1 && BLOCK_DEFINITIONS[type].singleton) {
      issues.push({
        code: "structure-duplicate-singleton",
        location: where(page, blockLabel(type)),
        reason: `1ページに1つだけのはずの「${blockLabel(type)}」が${count}個あります。`,
        suggestion: "余分なほうを削除するか非表示にしてください。",
        severity: "high",
      });
    }
  }

  // Only the top page is required to have one. A 診療案内 page opening with its own heading rather
  // than a second main visual is normal, not a defect.
  if (!counts.has("hero")) {
    if (isHome) {
      issues.push({
        code: "structure-no-hero",
        location: where(page, "ページ全体"),
        reason: "メインビジュアルがありません。ページの顔になる部分が欠けています。",
        suggestion: "メインビジュアルを追加してください。",
        severity: "high",
      });
    }
  } else if (visible[0].type !== "hero") {
    issues.push({
      code: "structure-hero-not-first",
      location: where(page, blockLabel("hero")),
      reason: "メインビジュアルがページの先頭にありません。",
      suggestion: "先頭へ移動してください。",
      severity: "low",
    });
  }

  const navLabels = visible.map((b) => b.navLabel.trim()).filter((l) => l.length > 0);
  const duplicated = navLabels.filter((label, i) => navLabels.indexOf(label) !== i);
  for (const label of new Set(duplicated)) {
    issues.push({
      code: "structure-duplicate-nav",
      location: where(page, `メニュー / ${label}`),
      reason: `メニュー項目「${label}」が重複しています。どちらへ飛ぶのか分かりません。`,
      suggestion: "片方の名前を変えてください。",
      severity: "low",
    });
  }

  return issues;
}

/** Text long enough to break out of the box it is drawn in. These thresholds come from the widths the
 * rendered layout actually gives each element at 390px, not from a general style guide. */
const MAX_LENGTHS = {
  heroHeadline: 40,
  cardHeading: 24,
  priceName: 30,
  /** Total of all nav labels — the desktop header lays them out on one row. */
  navTotal: 60,
} as const;

function checkOverflowRisk(doc: SiteDocument): DesignIssue[] {
  const issues: DesignIssue[] = [];

  for (const block of doc.blocks) {
    if (!block.visible) continue;

    if (block.type === "hero" && charCount(block.data.headline) > MAX_LENGTHS.heroHeadline) {
      issues.push({
        code: "overflow-hero-headline",
        location: `${blockLabel(block.type)} / キャッチコピー`,
        reason: `${charCount(block.data.headline)}文字あります。スマートフォンでは画面からはみ出すか、極端に小さく表示されます。`,
        suggestion: `${MAX_LENGTHS.heroHeadline}文字以内に収め、続きはサブコピーへ移してください。`,
        severity: "medium",
      });
    }

    if (block.type === "rich") {
      block.data.cards.forEach((card, i) => {
        if (charCount(card.heading) > MAX_LENGTHS.cardHeading) {
          issues.push({
            code: "overflow-card-heading",
            location: `${blockWhere(block)} / カード${i + 1}の見出し`,
            reason: `${charCount(card.heading)}文字あります。カードの幅に収まらず、折り返しで高さが不揃いになります。`,
            suggestion: `${MAX_LENGTHS.cardHeading}文字以内にしてください。`,
            severity: "low",
          });
        }
      });
    }

    if (block.type === "pricing") {
      block.data.items.forEach((item, i) => {
        if (charCount(item.name) > MAX_LENGTHS.priceName) {
          issues.push({
            code: "overflow-price-name",
            location: `${blockWhere(block)} / ${i + 1}行目`,
            reason: `項目名が${charCount(item.name)}文字あります。金額の列が押し出されて表が崩れます。`,
            suggestion: `${MAX_LENGTHS.priceName}文字以内にし、詳細は備考欄へ移してください。`,
            severity: "low",
          });
        }
      });
    }
  }

  // ⚠️ Measured per page, on the row that is actually drawn: the page links plus THAT page's own
  // section anchors. Summing every block in the document was right while there was one page and is
  // now simply wrong — it would over-count a six-page site and under-count nothing, and it would
  // miss the new way this fails (six page links plus six anchors on one row).
  for (const page of doc.pages) {
    const labels = [
      ...doc.pages.filter((p) => p.inNav).map((p) => p.navLabel),
      ...pageBlocks(doc, page.id).map((b) => b.navLabel),
    ];
    const navTotal = labels.reduce((total, label) => total + charCount(label.trim()), 0);
    if (navTotal > MAX_LENGTHS.navTotal) {
      issues.push({
        code: "overflow-nav",
        location: doc.pages.length > 1 ? `${page.navLabel} / メニュー` : "メニュー",
        reason: `メニュー項目の合計が${navTotal}文字あります。PCのヘッダーで折り返し、ロゴと重なるおそれがあります。`,
        suggestion: "項目名を短くするか、メニューに出さないセクションを増やしてください。",
        severity: "low",
      });
    }
  }

  return issues;
}

/** Combinations where the content and the chosen layout disagree — the layout still renders, it just
 * renders badly (one lonely card in a grid built for three, a stagger with nothing to stagger). */
function checkLayoutFit(doc: SiteDocument): DesignIssue[] {
  const issues: DesignIssue[] = [];

  for (const block of doc.blocks) {
    if (!block.visible || block.type !== "rich") continue;
    const layout = effectiveCardLayout(block, doc.design);
    const count = block.data.cards.length;

    if (count === 0 && !block.data.body.trim()) {
      issues.push({
        code: "layout-empty-section",
        location: blockWhere(block),
        reason: "本文もカードも無く、見出しだけのセクションになっています。",
        suggestion: "本文を書くか、このセクションを非表示にしてください。",
        severity: "medium",
      });
      continue;
    }

    if (count === 1 && (layout === "grid" || layout === "overlap")) {
      issues.push({
        code: "layout-single-card",
        location: blockWhere(block),
        reason: `カードが1枚しかありません。「${layout === "grid" ? "グリッド" : "重ね"}」の並べ方は複数枚を前提にしているため、間延びして見えます。`,
        suggestion: "カードを2枚以上にするか、テンプレートの並べ方を変更してください。",
        severity: "low",
      });
    }
  }

  // normalizeDesignTokens (importFromUrl.ts) already rules this pair out for imported templates, but a
  // hand-edited template can still reach it: the element waits on the IntersectionObserver at opacity
  // 0 and then snaps in, which reads as content flashing rather than as a design choice.
  const { reveal, duration } = doc.design.animation;
  if (reveal !== "none" && duration === 0) {
    issues.push({
      code: "layout-reveal-no-duration",
      location: "デザイン設定 / 動き",
      reason: "スクロール演出が有効なのに、動きの長さが0です。要素が点滅したように現れます。",
      suggestion: "動きの長さを200ms以上にするか、演出を「なし」にしてください。",
      severity: "medium",
    });
  }

  return issues;
}

// --- entry point ---------------------------------------------------------------------------------

const SEVERITY_ORDER: Record<DesignIssueSeverity, number> = { high: 0, medium: 1, low: 2 };

export function checkDesign(doc: SiteDocument, options: { outDir?: string } = {}): DesignCheckResult {
  const issues = [
    ...checkStructure(doc),
    ...checkImages(doc, options.outDir),
    ...checkRequiredText(doc),
    ...checkContrast(doc),
    ...checkLayoutFit(doc),
    ...checkOverflowRisk(doc),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const high = issues.filter((i) => i.severity === "high").length;
  const medium = issues.filter((i) => i.severity === "medium").length;

  return {
    // "ok" means publishable, not spotless: `low` findings are suggestions, and blocking on them
    // would make the check something people learn to ignore.
    ok: high === 0 && medium === 0,
    summary:
      issues.length === 0
        ? "問題は見つかりませんでした。"
        : high > 0
          ? `要修正が${high}件あります。このまま公開すると表示が崩れます。`
          : medium > 0
            ? `要確認が${medium}件あります。公開前に見直してください。`
            : `改善余地が${issues.length}件あります。公開に支障はありません。`,
    issues,
  };
}
