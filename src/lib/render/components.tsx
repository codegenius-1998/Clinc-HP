import type { CSSProperties } from "react";
import type {
  SiteViewModel,
  SectionView,
  HoursRow,
  NewsItem,
  FaqItem,
  PriceItem,
  StaffMember,
  NavItem,
} from "./types";

function Header({ vm }: { vm: SiteViewModel }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label={vm.clinicName}>
        <img src={vm.logoImage} alt={vm.clinicName} />
        <span className="clinic-name">{vm.clinicName}</span>
      </a>
      {vm.phone && (
        <a className="header-tel" href={`tel:${vm.phone.replace(/[^\d+]/g, "")}`}>
          {vm.phone}
        </a>
      )}
      <input type="checkbox" id="nav-toggle" className="nav-toggle" />
      <label htmlFor="nav-toggle" className="nav-toggle-label" aria-label="メニュー">
        <span />
      </label>
    </header>
  );
}

function Nav({ items }: { items: NavItem[] }) {
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
        <a className="btn btn-line" href={`https://line.me/R/ti/p/${encodeURIComponent(line.startsWith("@") ? line : `@${line}`)}`}>
          LINEで相談・予約する
        </a>
      )}
      {tel && (
        <a className="btn btn-tel" href={`tel:${tel.replace(/[^\d+]/g, "")}`}>
          お電話で相談・予約する
        </a>
      )}
    </div>
  );
}

function Hero({ vm }: { vm: SiteViewModel }) {
  return (
    <section id="top" className="hero">
      <img src={vm.heroImage} alt="" />
      <div className="hero-copy">
        <h1>{vm.heroHeadline}</h1>
        {vm.heroSubheadline && <p>{vm.heroSubheadline}</p>}
        <CtaButtons tel={vm.phone} line={vm.line} />
      </div>
    </section>
  );
}

/** Renders one AI-authored body section (department/greeting/features/facility). A section-level
 * `image` renders as a side-by-side split layout; per-block images (department cards) render as a
 * card grid; sections with neither image kind still render fine as plain heading+body+card text. */
function AiSection({ section }: { section: SectionView }) {
  const hasBlockImages = section.blocks.some((b) => b.image);
  return (
    <section id={section.id} className="section">
      <div className="section-inner">
        <h2>{section.label}</h2>
        {section.image ? (
          <div className="split">
            <img src={section.image} alt="" />
            <div className="text">
              <p className="lead">{section.body}</p>
            </div>
          </div>
        ) : (
          section.body && <p className="lead">{section.body}</p>
        )}
        {section.blocks.length > 0 && (
          <div className="cards">
            {section.blocks.map((block, i) => (
              <div className="card" key={i}>
                {hasBlockImages && block.image && <img src={block.image} alt="" />}
                <div className="card-body">
                  <h3>{block.heading}</h3>
                  <p>{block.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HoursSection({ rows }: { rows: HoursRow[] }) {
  return (
    <section id="hours" className="section">
      <div className="section-inner">
        <h2>診療時間</h2>
        <table className="info-table">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.label && <th>{row.label}</th>}
                <td colSpan={row.label ? undefined : 2}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccessSection({ address, mapQuery }: { address?: string; mapQuery?: string }) {
  return (
    <section id="access" className="section">
      <div className="section-inner">
        <h2>アクセス</h2>
        {address && <p className="lead">{address}</p>}
        {mapQuery && (
          <div className="map-frame">
            <iframe src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`} loading="lazy" title="アクセスマップ" />
          </div>
        )}
      </div>
    </section>
  );
}

function NewsSection({ items }: { items: NewsItem[] }) {
  return (
    <section id="news" className="section">
      <div className="section-inner">
        <h2>お知らせ</h2>
        <ul className="news-list">
          {items.map((item, i) => (
            <li key={i}>
              {item.date && <time>{item.date}</time>}
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StaffSection({ members }: { members: StaffMember[] }) {
  return (
    <section id="staff" className="section">
      <div className="section-inner">
        <h2>スタッフ紹介</h2>
        <div className="staff-grid">
          {members.map((m, i) => (
            <div className="staff-card" key={i}>
              {m.image && <img src={m.image} alt={m.name} />}
              <h3>{m.name}</h3>
              {m.role && <p className="role">{m.role}</p>}
              <p>{m.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="section">
      <div className="section-inner">
        <h2>よくある質問</h2>
        <div className="faq-list">
          {items.map((item, i) => (
            <div className="faq-item" key={i}>
              <p className="q">{item.question}</p>
              <p className="a">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ items }: { items: PriceItem[] }) {
  return (
    <section id="pricing" className="section">
      <div className="section-inner">
        <h2>料金表</h2>
        <table className="info-table">
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td className="price">{item.price}</td>
                <td>{item.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ContactSection({ vm }: { vm: SiteViewModel }) {
  return (
    <section id="contact" className="section contact-section">
      <div className="section-inner">
        <h2>お問い合わせ・ご予約</h2>
        <p className="lead">お電話またはLINEにて、お気軽にご相談・ご予約ください。</p>
        <CtaButtons tel={vm.phone} line={vm.line} />
      </div>
    </section>
  );
}

function Footer({ vm }: { vm: SiteViewModel }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <h3>{vm.clinicName}</h3>
          <p className="footer-address">
            {[vm.address, vm.phone].filter(Boolean).join("\n")}
          </p>
          {vm.snsLinks.length > 0 && (
            <div className="footer-sns">
              {vm.snsLinks.map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <nav className="footer-nav">
          <a href="#top">ホーム</a>
          {vm.navItems.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <p className="copyright">Copyright © {vm.clinicName} All Rights Reserved.</p>
    </footer>
  );
}

/** section id -> renderer, for the fixed (non-AI-authored) body sections. AI-authored sections
 * (department/greeting/features/facility) all share `AiSection` instead. */
function renderFixedSection(vm: SiteViewModel, id: string) {
  switch (id) {
    case "hours":
      return vm.hours.visible ? <HoursSection key={id} rows={vm.hours.rows} /> : null;
    case "access":
      return vm.access.visible ? <AccessSection key={id} address={vm.address} mapQuery={vm.mapQuery} /> : null;
    case "news":
      return vm.news.visible ? <NewsSection key={id} items={vm.news.items} /> : null;
    case "staff":
      return vm.staff.visible ? <StaffSection key={id} members={vm.staff.members} /> : null;
    case "faq":
      return vm.faq.visible ? <FaqSection key={id} items={vm.faq.items} /> : null;
    case "pricing":
      return vm.pricing.visible ? <PricingSection key={id} items={vm.pricing.items} /> : null;
    case "contact":
      return <ContactSection key={id} vm={vm} />;
    default:
      return null;
  }
}

const FIXED_SECTION_IDS = new Set(["hours", "access", "news", "staff", "faq", "pricing", "contact"]);

/** Top-level page. `vm.navItems` is already the final visible+ordered section list (computed in
 * siteGenerator.ts from SITE_SPEC + the user's sectionPrefs) — this component just renders each one
 * in that order, picking `AiSection` for AI-authored content and the matching fixed component
 * otherwise. Header/Hero/Footer are structural and always render regardless of navItems. */
export function SitePage({ vm }: { vm: SiteViewModel }) {
  const aiSectionsById = new Map(vm.aiSections.map((s) => [s.id, s]));
  const themeStyle = {
    "--primary": vm.theme.tokens.primary,
    "--accent": vm.theme.tokens.accent,
    "--light": vm.theme.tokens.light,
    "--primary-inverse": vm.theme.tokens.primaryInverse ?? "#fff",
    "--accent-inverse": vm.theme.tokens.accentInverse ?? "#fff",
    "--radius": vm.cardStyle === "sharp" ? "2px" : "12px",
    "--font":
      vm.fontFamily === "serif"
        ? '"Hiragino Mincho ProN", "Yu Mincho", serif'
        : '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
  } as CSSProperties;
  return (
    <html lang="ja" style={themeStyle}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{vm.seo.title}</title>
        <meta name="description" content={vm.seo.metaDescription} />
        <meta property="og:type" content="business.business" />
        <meta property="og:title" content={vm.seo.ogTitle} />
        <meta property="og:description" content={vm.seo.ogDescription} />
        <meta property="og:site_name" content={vm.seo.ogSiteName} />
        <link rel="stylesheet" href="css/site.css" />
      </head>
      <body>
        <Header vm={vm} />
        <Nav items={vm.navItems} />
        <Hero vm={vm} />
        <main>
          {vm.navItems.map((item) => (aiSectionsById.has(item.id) ? <AiSection key={item.id} section={aiSectionsById.get(item.id)!} /> : FIXED_SECTION_IDS.has(item.id) ? renderFixedSection(vm, item.id) : null))}
        </main>
        <Footer vm={vm} />
      </body>
    </html>
  );
}
