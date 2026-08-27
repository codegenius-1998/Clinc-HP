import type { CSSProperties } from "react";
import type { Block, BlockOf, DesignTokens, SiteDocument } from "@/lib/site/document";
import { findPage, homeHref, navItems, pageBlocks, type NavItem } from "@/lib/site/pages";
import { readableFill, readableOn } from "@/lib/site/color";
import { effectiveCardLayout, effectiveHeroLayout, sectionVariantClass } from "@/lib/site/composition";
import { blockSupportsPadding } from "@/lib/site/blocks";
import { resolveStyleKit } from "./kits";

/** Renders a SiteDocument to a static page. The page is driven entirely by `doc.blocks` in array
 * order — there is no fixed section list and no per-type visibility logic left in here, because a
 * block's own `visible` flag and its position in the array already say everything. That is what makes
 * the editor's drag-to-reorder and add-block work: reordering the array reorders the page, full stop.
 *
 * Every block type in document.ts must have a case in `renderBlock` below; the exhaustiveness check
 * at the bottom of that switch turns a missing one into a compile error rather than a blank section. */

// --- design tokens -> CSS ------------------------------------------------------------------------

const SHADOWS: Record<DesignTokens["block"]["shadow"], string> = {
  none: "none",
  soft: "0 2px 12px rgba(0, 0, 0, 0.06)",
  strong: "0 10px 30px rgba(0, 0, 0, 0.14)",
};

/** Builds the Google Fonts stylesheet URL from entries like "Noto Sans JP:wght@400;700". Returns null
 * when a template uses system fonts only, so the generated page makes no external request at all. */
function googleFontsHref(families: string[]): string | null {
  const usable = families.map((f) => f.trim()).filter((f) => f.length > 0);
  if (usable.length === 0) return null;
  const query = usable.map((f) => `family=${f.replace(/ /g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function themeStyle(design: DesignTokens): CSSProperties {
  return {
    "--primary": design.colors.primary,
    "--accent": design.colors.accent,
    "--light": design.colors.light,
    "--bg": design.colors.background,
    "--text": design.colors.text,
    "--primary-inverse": design.colors.primaryInverse,
    "--accent-inverse": design.colors.accentInverse,

    "--font-heading": design.font.headingFamily,
    "--font-body": design.font.bodyFamily,
    "--font-size": `${design.font.baseSize}px`,
    "--line-height": String(design.font.lineHeight),
    "--heading-weight": String(design.font.headingWeight),
    "--display-scale": String(design.font.displayScale),
    "--heading-tracking": `${design.font.headingLetterSpacing}em`,

    "--radius": `${design.block.radius}px`,
    "--border-width": `${design.block.borderWidth}px`,
    "--border-color": design.block.borderColor,
    "--shadow": SHADOWS[design.block.shadow],
    "--btn-scale": String(design.block.buttonScale),

    "--max-width": `${design.layout.maxWidth}px`,
    "--space-scale": String(design.layout.spacingScale),

    /* Text-safe variants. A template's palette comes from an arbitrary reference site, so `accent`
     * may be a colour that only works as a fill — LeadGrid's #ffe600 as a card heading on white is
     * ~1.2:1, i.e. invisible. These are derived rather than authored so every imported template is
     * readable without the admin having to notice. */
    "--primary-text": readableOn(design.colors.primary, design.colors.background, design.colors.text),
    "--accent-text": readableOn(design.colors.accent, design.colors.background, design.colors.text),

    /* Surface variants, for the two places a label sits ON the brand colour: the navigation bar and
     * the 電話 button. Derived the other way round from the two above — there the text moves, here
     * the fill does, because darkening a white button label reads as a mistake rather than a choice.
     * The stock palette needs it: white on #4ba3fc is 2.6:1. `--primary` itself is left alone, so
     * underlines, rules and gradients keep the authored colour exactly. */
    "--primary-fill": readableFill(design.colors.primary, design.colors.primaryInverse),
    "--accent-fill": readableFill(design.colors.accent, design.colors.accentInverse),

    "--reveal-duration": `${design.animation.duration}ms`,

    /* The decorative layer. The PATTERN is a CSS mask (site.css) so it is painted in `--primary` and
     * follows the palette; only its strength is a number, and only the number needs to come from
     * here. The backdrop PHOTO is not a variable at all — see backdropCss. */
    "--ornament-strength": String(design.layout.ornamentStrength),

    /* The footer's colours were literal hex values in site.css with no token behind them, so a
     * template could restyle every other surface and still ship the same charcoal footer. These
     * defaults ARE those literals, so nothing changes until a chrome variant asks it to. */
    ...footerColors(design),
  } as CSSProperties;
}

/** The backdrop photograph's CSS, emitted into the page rather than living in site.css.
 *
 * ⚠️ This is not a style preference. A relative `url()` is resolved against the STYLESHEET that uses
 * it, and site.css is served from `css/site.css` — so `url("images/backdrop.jpg")` reaching site.css
 * through a custom property resolved to `css/images/backdrop.jpg` and the photograph silently never
 * appeared (measured in Chromium: the computed value came back with the `css/` segment in it).
 * A `<style>` element's base URL is the DOCUMENT's, so writing the declaration here — with the path
 * written literally, no `var()` in between — makes it resolve exactly like every `<img src>` on the
 * page. The site's flat output (see site/pages.ts) is what lets one relative path work from every
 * page, locally and at a domain root alike.
 *
 * The scrim is what keeps the design check honest: `checkContrast` compares TOKENS, so text over a
 * photograph is invisible to it. Holding the effective background at `--bg` means the check is still
 * measuring the thing that is actually behind the words. */
function backdropCss(mode: "page" | "sections", image: string): string {
  const target = mode === "page" ? "html[data-backdrop=\"page\"] body" : "html[data-backdrop=\"sections\"] .section-alt";
  const paint = `linear-gradient(var(--backdrop-scrim), var(--backdrop-scrim)), url("${image}")`;
  return [
    `${target}{background-image:${paint};background-size:cover;background-position:center;background-repeat:no-repeat;background-attachment:fixed;}`,
    // 淡色セクションに敷く場合、ベタ塗りの --light が写真を完全に覆ってしまう。
    mode === "sections" ? `html[data-backdrop="sections"] .section-alt{background-color:var(--bg);}` : "",
    // ⚠️ background-attachment: fixed はアニメーションではないので、prefers-reduced-motion の
    // 一括指定（animation-duration: 0.01ms）では止まらない。明示的に外す。スマートフォンでは
    // 実装差で崩れる（iOS は事実上 scroll 扱い）ので、そちらでも外す。
    `@media (prefers-reduced-motion: reduce),(max-width:767px){${target}{background-attachment:scroll;}}`,
  ]
    .filter(Boolean)
    .join("");
}

// --- per-field/per-block style overrides (visual editor) -----------------------------------------

/** Turns one field's `textStyles` override (see document.ts) into inline CSS, or `undefined` when the
 * field has no override — so the element falls through to the design's global font/color exactly as
 * before this feature existed. `path` is the same field-path string emitted as `data-field` below;
 * the visual editor's canvas resolves clicks back to a path the same way it was written here. */
function textStyleCss(block: Block, path: string): CSSProperties | undefined {
  const style = block.textStyles?.[path];
  if (!style) return undefined;
  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize !== undefined ? `${style.fontSize}px` : undefined,
    fontWeight: style.fontWeight,
  };
}

/** Turns a block's `spacing` override into inline CSS for its outer element. Padding is a longhand
 * (`padding-top`/`padding-bottom`), so it overrides `.section`'s shorthand `padding` per normal
 * cascade rules without needing any site.css change. Omitted entirely for `hero`/`imageBanner` (see
 * blockSupportsPadding) — those two put their image directly in the outer box with no inner padded
 * wrapper, so outer padding would inset the image itself. Margin is always safe: `.section` sets none
 * today, so this is purely additive for every block type. */
function spacingCss(block: Block): CSSProperties | undefined {
  const spacing = block.spacing;
  if (!spacing) return undefined;
  const style: CSSProperties = {};
  if (blockSupportsPadding(block.type)) {
    if (spacing.paddingTop !== undefined) style.paddingTop = `${spacing.paddingTop}px`;
    if (spacing.paddingBottom !== undefined) style.paddingBottom = `${spacing.paddingBottom}px`;
  }
  if (spacing.marginTop !== undefined) style.marginTop = `${spacing.marginTop}px`;
  if (spacing.marginBottom !== undefined) style.marginBottom = `${spacing.marginBottom}px`;
  return Object.keys(style).length > 0 ? style : undefined;
}

/** Turns one `containerStyles` entry into inline CSS. Padding/margin are emitted as longhands so they
 * beat site.css's shorthands by normal cascade order without any !important. The "section" container
 * deliberately takes only its colours from here — its padding/margin come from `spacingCss` above, so
 * the two never write the same property. */
function containerCss(block: Block, path: string): CSSProperties | undefined {
  const c = block.containerStyles?.[path];
  if (!c) return undefined;
  const style: CSSProperties = {};
  if (c.background) style.background = c.background;
  if (c.color) style.color = c.color;
  if (path !== "section") {
    if (c.paddingTop !== undefined) style.paddingTop = `${c.paddingTop}px`;
    if (c.paddingBottom !== undefined) style.paddingBottom = `${c.paddingBottom}px`;
    if (c.paddingLeft !== undefined) style.paddingLeft = `${c.paddingLeft}px`;
    if (c.paddingRight !== undefined) style.paddingRight = `${c.paddingRight}px`;
    if (c.marginTop !== undefined) style.marginTop = `${c.marginTop}px`;
    if (c.marginBottom !== undefined) style.marginBottom = `${c.marginBottom}px`;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

/** The section's own background photograph, under a scrim of the page background.
 *
 * ⚠️ Emitted inline, and that is the whole reason it lives here rather than in site.css. A relative
 * `url()` resolves against the STYLESHEET that uses it, and site.css is served from `css/site.css` —
 * so `images/x.jpg` reaching it would resolve to `css/images/x.jpg` and the photograph would silently
 * never appear. This is the same trap `backdropCss` documents above; an element's `style` attribute
 * has the DOCUMENT's base URL, so here the path resolves exactly like every `<img src>` on the page.
 *
 * ⚠️ The scrim is not decoration. `checkContrast` compares design TOKENS and cannot see text sitting
 * on a photograph, so holding the effective background near `--bg` is what keeps that check honest
 * (see the note on `Block.backgroundScrim`).
 *
 * ⚠️ Longhands, deliberately. `containerCss` may have already written the `background` SHORTHAND for
 * this same element, and a shorthand resets `background-image` to `none`. Emitting the longhands
 * afterwards — which the spread order below guarantees — is what lets a section carry a colour and a
 * photograph at once. */
function backgroundImageCss(block: Block): CSSProperties | undefined {
  if (!block.backgroundImage) return undefined;
  const scrim = `color-mix(in srgb, var(--bg) ${Math.round(block.backgroundScrim * 100)}%, transparent)`;
  return {
    backgroundImage: `linear-gradient(${scrim}, ${scrim}), url("${block.backgroundImage}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

/** Outer <section> style = spacing override (padding/margin) + container override (colours) + the
 * section's background photograph. The photograph goes last so its longhands survive — see above. */
function sectionCss(block: Block): CSSProperties | undefined {
  const merged = { ...spacingCss(block), ...containerCss(block, "section"), ...backgroundImageCss(block) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

// --- structural chrome ---------------------------------------------------------------------------

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function lineHref(line: string): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(line.startsWith("@") ? line : `@${line}`)}`;
}

/** `--footer-bg` / `--footer-text` for the chosen footer form. "dark" reproduces the values that
 * were hardcoded in site.css. "band" reuses `readableFill`, so the brand colour is deepened exactly
 * as it is for the nav bar and the phone button rather than by a second, divergent rule. */
function footerColors(design: DesignTokens): Record<string, string> {
  switch (design.chrome.footer) {
    case "light":
      return { "--footer-bg": design.colors.light, "--footer-text": design.colors.text };
    case "band":
      return {
        "--footer-bg": readableFill(design.colors.primary, design.colors.primaryInverse),
        "--footer-text": design.colors.primaryInverse,
      };
    default:
      return { "--footer-bg": "#2b2f36", "--footer-text": "#dcdfe4" };
  }
}

function Header({ doc, pageId }: { doc: SiteDocument; pageId: string }) {
  const { meta } = doc;
  return (
    <header className="site-header">
      {/* "#top" on the home page, "index.html" everywhere else — a brand mark that reloads the page
          you are already on reads as a broken link. */}
      <a className="brand" href={homeHref(doc, pageId)} aria-label={meta.clinicName}>
        {meta.logoImage && <img src={meta.logoImage} alt={meta.clinicName} />}
        <span className="clinic-name">{meta.clinicName}</span>
      </a>
      {meta.phone && (
        <a className="header-tel" href={telHref(meta.phone)}>
          {meta.phone}
        </a>
      )}
      {/* The checkbox itself lives OUTSIDE this header (see SitePage) so that it and <nav> are
          siblings — the CSS-only hamburger relies on `.nav-toggle:checked ~ nav.site-nav`, which
          only matches between elements sharing a parent. A <label for> works across the document,
          so the button can still sit here in the header. */}
      <label htmlFor="nav-toggle" className="nav-toggle-label" aria-label="メニュー">
        <span />
      </label>
    </header>
  );
}

/** The page's own navigation: the site's pages, then this page's sections. Both kinds are plain
 * links — `aria-current` is what tells a screen reader (and the CSS) which page is open, since a
 * static site has no other way to say so. */
function Nav({ items }: { items: NavItem[] }) {
  return (
    <nav className="site-nav">
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              className={item.kind === "page" && item.current ? "is-current" : undefined}
              aria-current={item.kind === "page" && item.current ? "page" : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CtaButtons({ tel, line }: { tel?: string; line?: string }) {
  if (!tel && !line) return null;
  return (
    <div className="cta-buttons">
      {line && (
        <a className="btn btn-line" href={lineHref(line)}>
          LINEで相談・予約する
        </a>
      )}
      {tel && (
        <a className="btn btn-tel" href={telHref(tel)}>
          お電話で相談・予約する
        </a>
      )}
    </div>
  );
}

function Footer({ doc, pageId }: { doc: SiteDocument; pageId: string }) {
  const { meta } = doc;
  // Same list as the header's, so the two can never disagree about what this site contains.
  const items = navItems(doc, pageId);
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <h3>{meta.clinicName}</h3>
          <p className="footer-address">{[meta.address, meta.phone].filter(Boolean).join("\n")}</p>
          {meta.snsLinks.length > 0 && (
            <div className="footer-sns">
              {meta.snsLinks.map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <nav className="footer-nav">
          {items.map((item) => (
            <a key={item.key} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <p className="copyright">Copyright © {meta.clinicName} All Rights Reserved.</p>
    </footer>
  );
}

// --- blocks --------------------------------------------------------------------------------------

/** Wraps a block's contents in the standard <section> shell. The `reveal` class pairs with
 * main.js's IntersectionObserver; `id` doubles as the nav anchor. */
function Section({
  block,
  doc,
  className,
  cycle,
  children,
}: {
  block: Block;
  doc: SiteDocument;
  className?: string;
  /** This section's position in the 4-step `data-variety` cycle, counted per page. See SitePage. */
  cycle?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      id={block.id}
      // The variant class is added here rather than by each block component: there is one <section>
      // per block and this is it, so nine components do not each have to remember.
      className={["section", className, sectionVariantClass(block)].filter(Boolean).join(" ")}
      style={sectionCss(block)}
      data-container="section"
      data-cycle={cycle === undefined ? undefined : String(cycle)}
    >
      {/* The decorative layer, and the ONLY thing ambient motion is ever allowed to move.
          ⚠️ Emitted only when the template asked for a pattern, so a document with `ornament: "none"`
          — which is every document written before this existed — produces byte-identical HTML.
          ⚠️ A real element rather than `.section::before`: `data-divider="wave"` already owns
          `.section-alt::before` AND `::after`, and `.section-alt` is the same element as `.section`,
          so a pseudo-element here would silently delete the wave divider on tinted sections.
          ⚠️ `position: absolute; inset: 0` inside a box with `overflow-x: clip` (site.css) is what
          makes it structurally impossible for a decoration to bring back the 390px horizontal-scroll
          bug. Nothing decorative may be positioned by a negative margin.
          ⚠️ A style kit gets the same layer even with `ornament: "none"`, and that is deliberate:
          it hands every kit one safe, already-clipped, already-unclickable canvas to draw on, so a
          kit never has to position anything itself. site.css blanks it (`background: none`) when no
          pattern was asked for, so a kit that ignores the layer still renders nothing. */}
      {(doc.design.layout.ornament !== "none" || resolveStyleKit(doc.design.layout.styleKit)) && (
        <span className="ornament" aria-hidden="true" />
      )}
      <div className="section-inner reveal" style={containerCss(block, "inner")} data-container="inner">
        {children}
      </div>
    </section>
  );
}

function HeroBlock({ block, doc }: { block: BlockOf<"hero">; doc: SiteDocument }) {
  return (
    <section id={block.id} className={`hero hero-${effectiveHeroLayout(doc)}`} style={sectionCss(block)} data-container="section">
      {block.data.image && (
        <img className="hero-image" src={block.data.image} alt="" data-block-id={block.id} data-field="image" />
      )}
      {/* Scroll cue. Outside .hero-copy on purpose: .hero-copy carries `reveal`, so anything inside it
          starts at opacity 0 and waits on the IntersectionObserver — a "keep scrolling" hint that is
          invisible until it scrolls into view is useless, since it sits on the first screen. */}
      <span className="hero-scroll" aria-hidden="true" />
      <div className="hero-copy reveal">
        <h1 data-block-id={block.id} data-field="headline" style={textStyleCss(block, "headline")}>
          {block.data.headline}
        </h1>
        {block.data.subheadline && (
          <p data-block-id={block.id} data-field="subheadline" style={textStyleCss(block, "subheadline")}>
            {block.data.subheadline}
          </p>
        )}
        <CtaButtons tel={doc.meta.phone} line={doc.meta.line} />
      </div>
    </section>
  );
}

/** The general-purpose content section — 診療科案内 / ご挨拶 / 特徴 / 施設案内 are all this one type,
 * distinguished only by their text. A section-level image renders as a side-by-side split; card
 * images render in whichever layout the template chose. "minimal" drops card images entirely in
 * favour of a numbered accent, which is why the <img> must not render at all (an empty broken image
 * would still occupy layout) rather than merely being hidden in CSS. */
function RichBlock({ block, doc, cycle }: { block: BlockOf<"rich">; doc: SiteDocument; cycle?: number }) {
  const layout = effectiveCardLayout(block, doc.design);
  const showCardImages = layout !== "minimal";
  return (
    <Section block={block} doc={doc} cycle={cycle}>
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      {block.data.image ? (
        <div className="split">
          <img src={block.data.image} alt="" data-block-id={block.id} data-field="image" />
          <div className="text">
            {block.data.body && (
              <p className="lead" data-block-id={block.id} data-field="body" style={textStyleCss(block, "body")}>
                {block.data.body}
              </p>
            )}
          </div>
        </div>
      ) : (
        block.data.body && (
          <p className="lead" data-block-id={block.id} data-field="body" style={textStyleCss(block, "body")}>
            {block.data.body}
          </p>
        )
      )}
      {block.data.cards.length > 0 && (
        <div className={`cards cards-${layout}`}>
          {block.data.cards.map((card, i) => (
            <div className="card" key={i} data-container={`card.${i}`} style={containerCss(block, `card.${i}`)}>
              {layout === "minimal" ? (
                <span className="card-index" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
              ) : (
                showCardImages && card.image && <img src={card.image} alt="" data-block-id={block.id} data-field={`cards.${i}.image`} />
              )}
              <div className="card-body">
                <h3 data-block-id={block.id} data-field={`cards.${i}.heading`} style={textStyleCss(block, `cards.${i}.heading`)}>
                  {card.heading}
                </h3>
                <p data-block-id={block.id} data-field={`cards.${i}.body`} style={textStyleCss(block, `cards.${i}.body`)}>
                  {card.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function HoursBlock({ block, doc, cycle }: { block: BlockOf<"hours">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle} className="section-alt">
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      <table className="info-table">
        <tbody>
          {block.data.rows.map((row, i) => (
            <tr key={i}>
              <th data-block-id={block.id} data-field={`rows.${i}.label`} style={textStyleCss(block, `rows.${i}.label`)}>
                {row.label}
              </th>
              <td data-block-id={block.id} data-field={`rows.${i}.value`} style={textStyleCss(block, `rows.${i}.value`)}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {block.data.note && (
        <p className="note" data-block-id={block.id} data-field="note" style={textStyleCss(block, "note")}>
          {block.data.note}
        </p>
      )}
    </Section>
  );
}

/** `mapQuery` has no `data-field` — it never renders as visible text (it only feeds the embedded
 * map's URL), so there's nothing on the page a click could land on. It stays editable only via the
 * sidebar's BlockEditor form. */
function AccessBlock({ block, doc, cycle }: { block: BlockOf<"access">; doc: SiteDocument; cycle?: number }) {
  const query = block.data.mapQuery || encodeURIComponent(block.data.address);
  return (
    <Section block={block} doc={doc} cycle={cycle}>
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      {block.data.address && (
        <p className="lead" data-block-id={block.id} data-field="address" style={textStyleCss(block, "address")}>
          {block.data.address}
        </p>
      )}
      {query && (
        <div className="map-frame">
          <iframe
            src={`https://www.google.com/maps?q=${query}&output=embed`}
            loading="lazy"
            title="地図"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
      {block.data.note && (
        <p className="note" data-block-id={block.id} data-field="note" style={textStyleCss(block, "note")}>
          {block.data.note}
        </p>
      )}
    </Section>
  );
}

function NewsBlock({ block, doc, cycle }: { block: BlockOf<"news">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle} className="section-alt">
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      <ul className="news-list">
        {block.data.items.map((item, i) => (
          <li key={i}>
            <time data-block-id={block.id} data-field={`items.${i}.date`} style={textStyleCss(block, `items.${i}.date`)}>
              {item.date}
            </time>
            <div>
              <p data-block-id={block.id} data-field={`items.${i}.title`} style={textStyleCss(block, `items.${i}.title`)}>
                {item.title}
              </p>
              {item.body && (
                <p className="news-body" data-block-id={block.id} data-field={`items.${i}.body`} style={textStyleCss(block, `items.${i}.body`)}>
                  {item.body}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function StaffBlock({ block, doc, cycle }: { block: BlockOf<"staff">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle}>
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      <div className="staff-grid">
        {block.data.members.map((member, i) => (
          <div className="staff-card" key={i}>
            {member.image && <img src={member.image} alt={member.name} data-block-id={block.id} data-field={`members.${i}.image`} />}
            <h3 data-block-id={block.id} data-field={`members.${i}.name`} style={textStyleCss(block, `members.${i}.name`)}>
              {member.name}
            </h3>
            {member.role && (
              <p className="role" data-block-id={block.id} data-field={`members.${i}.role`} style={textStyleCss(block, `members.${i}.role`)}>
                {member.role}
              </p>
            )}
            <p data-block-id={block.id} data-field={`members.${i}.comment`} style={textStyleCss(block, `members.${i}.comment`)}>
              {member.comment}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FaqBlock({ block, doc, cycle }: { block: BlockOf<"faq">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle} className="section-alt">
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      <div className="faq-list">
        {block.data.items.map((item, i) => (
          <div className="faq-item" key={i}>
            <button type="button" className="faq-q" aria-expanded="false">
              <span data-block-id={block.id} data-field={`items.${i}.question`} style={textStyleCss(block, `items.${i}.question`)}>
                {item.question}
              </span>
              <span className="faq-icon" aria-hidden>
                +
              </span>
            </button>
            <div className="faq-a">
              <p data-block-id={block.id} data-field={`items.${i}.answer`} style={textStyleCss(block, `items.${i}.answer`)}>
                {item.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PricingBlock({ block, doc, cycle }: { block: BlockOf<"pricing">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle}>
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      {/* The note lives INSIDE the name cell, not in a third column. As its own <td> it made rows
          with a note 3 cells wide and rows without 2, so the browser laid every row out to a
          different column split and the prices stopped lining up — the visible "broken table". */}
      <table className="price-table">
        <tbody>
          {block.data.items.map((item, i) => (
            <tr key={i}>
              <th>
                <span
                  className="price-name"
                  data-block-id={block.id}
                  data-field={`items.${i}.name`}
                  style={textStyleCss(block, `items.${i}.name`)}
                >
                  {item.name}
                </span>
                {item.note && (
                  <span
                    className="price-note"
                    data-block-id={block.id}
                    data-field={`items.${i}.note`}
                    style={textStyleCss(block, `items.${i}.note`)}
                  >
                    {item.note}
                  </span>
                )}
              </th>
              <td className="price" data-block-id={block.id} data-field={`items.${i}.price`} style={textStyleCss(block, `items.${i}.price`)}>
                {item.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {block.data.note && (
        <p className="note" data-block-id={block.id} data-field="note" style={textStyleCss(block, "note")}>
          {block.data.note}
        </p>
      )}
    </Section>
  );
}

function ContactBlock({ block, doc, cycle }: { block: BlockOf<"contact">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle} className="contact-section">
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      {block.data.lead && (
        <p className="lead" data-block-id={block.id} data-field="lead" style={textStyleCss(block, "lead")}>
          {block.data.lead}
        </p>
      )}
      <CtaButtons tel={doc.meta.phone} line={doc.meta.line} />
    </Section>
  );
}

function FreeTextBlock({ block, doc, cycle }: { block: BlockOf<"freeText">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle} className={`free-text align-${block.data.align}`}>
      {block.data.heading && (
        <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
          {block.data.heading}
        </h2>
      )}
      <p className="lead" data-block-id={block.id} data-field="body" style={textStyleCss(block, "body")}>
        {block.data.body}
      </p>
    </Section>
  );
}

/** `href` has no `data-field` — a link target isn't a piece of visible text to click on; it stays
 * sidebar-only, same reasoning as `mapQuery` above. */
function ImageBannerBlock({ block }: { block: BlockOf<"imageBanner"> }) {
  const inner = (
    <>
      {block.data.image && (
        <img src={block.data.image} alt={block.data.caption ?? ""} data-block-id={block.id} data-field="image" />
      )}
      {block.data.caption && (
        <span className="banner-caption" data-block-id={block.id} data-field="caption" style={textStyleCss(block, "caption")}>
          {block.data.caption}
        </span>
      )}
    </>
  );
  return (
    <section id={block.id} className={`image-banner banner-${block.data.height} reveal`} style={sectionCss(block)} data-container="section">
      {block.data.href ? (
        <a href={block.data.href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </section>
  );
}

function GalleryBlock({ block, doc, cycle }: { block: BlockOf<"gallery">; doc: SiteDocument; cycle?: number }) {
  return (
    <Section block={block} doc={doc} cycle={cycle}>
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      <div className={`gallery gallery-${block.data.columns}`}>
        {block.data.images.map((image, i) => (
          <figure key={i}>
            {image.src && (
              <img src={image.src} alt={image.caption ?? ""} loading="lazy" data-block-id={block.id} data-field={`images.${i}.src`} />
            )}
            {image.caption && (
              <figcaption data-block-id={block.id} data-field={`images.${i}.caption`} style={textStyleCss(block, `images.${i}.caption`)}>
                {image.caption}
              </figcaption>
            )}
          </figure>
        ))}
        {/* The second lap of the marquee. A strip that scrolls has to hold its own content twice or
            it shows a gap every time it wraps; the CSS translates the row by exactly -50%.
            ⚠️ No `data-block-id` and no `data-field` on the copy, deliberately. Those attributes are
            the join between the page and the visual editor's click-to-select, and a duplicate of
            `images.0.src` would give one field two elements — the editor would select and live-update
            whichever it reached first, and the other would sit there showing the old photo.
            Hidden from assistive technology for the same reason: it is the same pictures again. */}
        {sectionVariantClass(block) === "v-gallery-marquee" &&
          block.data.images.map((image, i) =>
            image.src ? <img key={`lap2-${i}`} className="marquee-copy" src={image.src} alt="" aria-hidden="true" loading="lazy" /> : null
          )}
      </div>
    </Section>
  );
}

/** One block -> one element. Exhaustive over BlockType: adding a type to document.ts without adding
 * it here is a compile error, not a silently missing section. */
function renderBlock(block: Block, doc: SiteDocument, cycle?: number) {
  switch (block.type) {
    case "hero":
      return <HeroBlock key={block.id} block={block} doc={doc} />;
    case "rich":
      return <RichBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "hours":
      return <HoursBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "access":
      return <AccessBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "news":
      return <NewsBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "staff":
      return <StaffBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "faq":
      return <FaqBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "pricing":
      return <PricingBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "contact":
      return <ContactBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "freeText":
      return <FreeTextBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    case "imageBanner":
      return <ImageBannerBlock key={block.id} block={block} />;
    case "gallery":
      return <GalleryBlock key={block.id} block={block} doc={doc} cycle={cycle} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

// --- page ----------------------------------------------------------------------------------------

export function SitePage({ doc, pageId }: { doc: SiteDocument; pageId: string }) {
  const { design, meta } = doc;
  // ⚠️ A backdrop with no photograph behind it would render as a flat scrim — a faint wash the admin
  // cannot explain and did not ask for. Until the image exists the whole treatment is off.
  const backdrop = design.layout.backdropImage ? design.layout.backdrop : "none";
  const page = findPage(doc, pageId);
  const visible = pageBlocks(doc, page.id);
  const fontsHref = googleFontsHref(design.font.googleFonts);
  // Resolved here rather than trusted: an unknown key renders the plain page (see kits/index.ts).
  const kit = resolveStyleKit(design.layout.styleKit);

  // ⚠️ Counts only the blocks that render a `.section`, and does so PER PAGE. The `data-variety`
  // rules used to be `main > .section:nth-of-type(4n + 2)`, where the `+2` was really "skip the
  // hero", since HeroBlock renders a <section> without the `.section` class. On a sub-page with no
  // hero every one of those rules landed one section early. Counting the sections themselves says
  // what was actually meant, and the CSS selectors keep the same specificity — see site.css.
  let sectionIndex = 0;
  const cycleOf = (block: Block): number | undefined =>
    block.type === "hero" || block.type === "imageBanner" ? undefined : sectionIndex++ % 4;


  return (
    <html
      lang="ja"
      style={themeStyle(design)}
      data-card-layout={design.block.cardLayout}
      data-hero={effectiveHeroLayout(doc, page.id)}
      data-divider={design.layout.sectionDivider}
      data-reveal={design.animation.reveal}
      data-stagger={design.animation.stagger ? "1" : "0"}
      data-parallax={design.animation.parallaxHero ? "1" : "0"}
      data-bg={design.layout.background}
      data-decoration={design.layout.decoration}
      data-rule={design.layout.rule}
      data-header={design.chrome.header}
      data-footer={design.chrome.footer}
      data-variety={design.animation.variety ? "1" : "0"}
      data-ornament={design.layout.ornament}
      data-ambient={design.animation.ambient}
      data-backdrop={backdrop}
      {...(kit ? { "data-kit": design.layout.styleKit } : {})}
    >
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* A page may title itself; empty falls back to the site's own SEO title, which is what a
            one-page document has always used. og:* stays document-level — it describes the clinic,
            not the section of the site you happened to open. */}
        <title>{page.title || meta.seo.title}</title>
        <meta name="description" content={page.metaDescription || meta.seo.metaDescription} />
        <meta property="og:type" content="business.business" />
        <meta property="og:title" content={meta.seo.ogTitle} />
        <meta property="og:description" content={meta.seo.ogDescription} />
        <meta property="og:site_name" content={meta.seo.ogSiteName} />
        {fontsHref && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontsHref} />
          </>
        )}
        <link rel="stylesheet" href="css/site.css" />
        {/* AFTER site.css on purpose: a kit is meant to override the shared stylesheet, and at equal
            specificity the later sheet wins. Before the backdrop <style> for the same reason — the
            backdrop is a document-level decision the kit must not be able to undo by accident. */}
        {kit && <link rel="stylesheet" href="css/kit.css" />}
        {backdrop !== "none" && (
          <style dangerouslySetInnerHTML={{ __html: backdropCss(backdrop, design.layout.backdropImage) }} />
        )}
      </head>
      <body>
        <a id="top" />
        {/* Reading progress. Fixed, 3px tall and outside the flow, so it cannot affect layout; the
            width comes from a custom property main.js writes. Kept out of the accessibility tree —
            it repeats information the scrollbar already gives. */}
        {design.animation.progressBar && <div className="scroll-progress" aria-hidden="true" />}
        {/* Sibling of <nav> on purpose — `.nav-toggle:checked ~ nav.site-nav` is what opens the
            mobile menu, and the general sibling combinator only reaches elements with the same
            parent. Its label sits inside the header. */}
        <input type="checkbox" id="nav-toggle" className="nav-toggle" />
        <Header doc={doc} pageId={page.id} />
        <Nav items={navItems(doc, page.id)} />
        <main>{visible.map((block) => renderBlock(block, doc, cycleOf(block)))}</main>
        <Footer doc={doc} pageId={page.id} />
        <script src="js/main.js" defer></script>
        {/* `defer` preserves document order, so a kit's script always runs after main.js has set up
            the reveal observer and the progress bar — a kit adds to that rather than racing it. */}
        {kit?.js && <script src="js/kit.js" defer></script>}
      </body>
    </html>
  );
}
