import type { CSSProperties } from "react";
import { navBlocks, type Block, type BlockOf, type DesignTokens, type SiteDocument } from "@/lib/site/document";
import { readableOn } from "@/lib/site/color";
import { blockSupportsPadding } from "@/lib/site/blocks";

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

    "--radius": `${design.block.radius}px`,
    "--border-width": `${design.block.borderWidth}px`,
    "--border-color": design.block.borderColor,
    "--shadow": SHADOWS[design.block.shadow],

    "--max-width": `${design.layout.maxWidth}px`,
    "--space-scale": String(design.layout.spacingScale),

    /* Text-safe variants. A template's palette comes from an arbitrary reference site, so `accent`
     * may be a colour that only works as a fill — LeadGrid's #ffe600 as a card heading on white is
     * ~1.2:1, i.e. invisible. These are derived rather than authored so every imported template is
     * readable without the admin having to notice. */
    "--primary-text": readableOn(design.colors.primary, design.colors.background, design.colors.text),
    "--accent-text": readableOn(design.colors.accent, design.colors.background, design.colors.text),

    "--reveal-duration": `${design.animation.duration}ms`,
  } as CSSProperties;
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

// --- structural chrome ---------------------------------------------------------------------------

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function lineHref(line: string): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(line.startsWith("@") ? line : `@${line}`)}`;
}

function Header({ doc }: { doc: SiteDocument }) {
  const { meta } = doc;
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label={meta.clinicName}>
        <img src={meta.logoImage} alt={meta.clinicName} />
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

function Nav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="site-nav">
      <ul>
        <li>
          <a href="#top">ホーム</a>
        </li>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
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

function Footer({ doc }: { doc: SiteDocument }) {
  const { meta } = doc;
  const items = navBlocks(doc);
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
          <a href="#top">ホーム</a>
          {items.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
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
  id,
  className,
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`section${className ? ` ${className}` : ""}`} style={style}>
      <div className="section-inner reveal">{children}</div>
    </section>
  );
}

function HeroBlock({ block, doc }: { block: BlockOf<"hero">; doc: SiteDocument }) {
  return (
    <section id={block.id} className={`hero hero-${doc.design.layout.heroLayout}`} style={spacingCss(block)}>
      <img className="hero-image" src={block.data.image} alt="" data-block-id={block.id} data-field="image" />
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
function RichBlock({ block, doc }: { block: BlockOf<"rich">; doc: SiteDocument }) {
  const layout = doc.design.block.cardLayout;
  const showCardImages = layout !== "minimal";
  return (
    <Section id={block.id} style={spacingCss(block)}>
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
            <div className="card" key={i}>
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

function HoursBlock({ block }: { block: BlockOf<"hours"> }) {
  return (
    <Section id={block.id} className="section-alt" style={spacingCss(block)}>
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
function AccessBlock({ block }: { block: BlockOf<"access"> }) {
  const query = block.data.mapQuery || encodeURIComponent(block.data.address);
  return (
    <Section id={block.id} style={spacingCss(block)}>
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

function NewsBlock({ block }: { block: BlockOf<"news"> }) {
  return (
    <Section id={block.id} className="section-alt" style={spacingCss(block)}>
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

function StaffBlock({ block }: { block: BlockOf<"staff"> }) {
  return (
    <Section id={block.id} style={spacingCss(block)}>
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

function FaqBlock({ block }: { block: BlockOf<"faq"> }) {
  return (
    <Section id={block.id} className="section-alt" style={spacingCss(block)}>
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

function PricingBlock({ block }: { block: BlockOf<"pricing"> }) {
  return (
    <Section id={block.id} style={spacingCss(block)}>
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

function ContactBlock({ block, doc }: { block: BlockOf<"contact">; doc: SiteDocument }) {
  return (
    <Section id={block.id} className="contact-section" style={spacingCss(block)}>
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

function FreeTextBlock({ block }: { block: BlockOf<"freeText"> }) {
  return (
    <Section id={block.id} className={`free-text align-${block.data.align}`} style={spacingCss(block)}>
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
      <img src={block.data.image} alt={block.data.caption ?? ""} data-block-id={block.id} data-field="image" />
      {block.data.caption && (
        <span className="banner-caption" data-block-id={block.id} data-field="caption" style={textStyleCss(block, "caption")}>
          {block.data.caption}
        </span>
      )}
    </>
  );
  return (
    <section id={block.id} className={`image-banner banner-${block.data.height} reveal`} style={spacingCss(block)}>
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

function GalleryBlock({ block }: { block: BlockOf<"gallery"> }) {
  return (
    <Section id={block.id} style={spacingCss(block)}>
      <h2 data-block-id={block.id} data-field="heading" style={textStyleCss(block, "heading")}>
        {block.data.heading}
      </h2>
      <div className={`gallery gallery-${block.data.columns}`}>
        {block.data.images.map((image, i) => (
          <figure key={i}>
            <img src={image.src} alt={image.caption ?? ""} loading="lazy" data-block-id={block.id} data-field={`images.${i}.src`} />
            {image.caption && (
              <figcaption data-block-id={block.id} data-field={`images.${i}.caption`} style={textStyleCss(block, `images.${i}.caption`)}>
                {image.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </Section>
  );
}

/** One block -> one element. Exhaustive over BlockType: adding a type to document.ts without adding
 * it here is a compile error, not a silently missing section. */
function renderBlock(block: Block, doc: SiteDocument) {
  switch (block.type) {
    case "hero":
      return <HeroBlock key={block.id} block={block} doc={doc} />;
    case "rich":
      return <RichBlock key={block.id} block={block} doc={doc} />;
    case "hours":
      return <HoursBlock key={block.id} block={block} />;
    case "access":
      return <AccessBlock key={block.id} block={block} />;
    case "news":
      return <NewsBlock key={block.id} block={block} />;
    case "staff":
      return <StaffBlock key={block.id} block={block} />;
    case "faq":
      return <FaqBlock key={block.id} block={block} />;
    case "pricing":
      return <PricingBlock key={block.id} block={block} />;
    case "contact":
      return <ContactBlock key={block.id} block={block} doc={doc} />;
    case "freeText":
      return <FreeTextBlock key={block.id} block={block} />;
    case "imageBanner":
      return <ImageBannerBlock key={block.id} block={block} />;
    case "gallery":
      return <GalleryBlock key={block.id} block={block} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

// --- page ----------------------------------------------------------------------------------------

export function SitePage({ doc }: { doc: SiteDocument }) {
  const { design, meta } = doc;
  const visible = doc.blocks.filter((b) => b.visible);
  const fontsHref = googleFontsHref(design.font.googleFonts);

  return (
    <html
      lang="ja"
      style={themeStyle(design)}
      data-card-layout={design.block.cardLayout}
      data-hero={design.layout.heroLayout}
      data-divider={design.layout.sectionDivider}
      data-reveal={design.animation.reveal}
      data-stagger={design.animation.stagger ? "1" : "0"}
      data-parallax={design.animation.parallaxHero ? "1" : "0"}
      data-bg={design.layout.background}
      data-decoration={design.layout.decoration}
      data-variety={design.animation.variety ? "1" : "0"}
    >
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{meta.seo.title}</title>
        <meta name="description" content={meta.seo.metaDescription} />
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
      </head>
      <body>
        <a id="top" />
        {/* Sibling of <nav> on purpose — `.nav-toggle:checked ~ nav.site-nav` is what opens the
            mobile menu, and the general sibling combinator only reaches elements with the same
            parent. Its label sits inside the header. */}
        <input type="checkbox" id="nav-toggle" className="nav-toggle" />
        <Header doc={doc} />
        <Nav items={navBlocks(doc)} />
        <main>{visible.map((block) => renderBlock(block, doc))}</main>
        <Footer doc={doc} />
        <script src="js/main.js" defer></script>
      </body>
    </html>
  );
}
