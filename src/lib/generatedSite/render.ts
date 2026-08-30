/** Turns a normalised `SiteTemplate` into the flat set of files that make up one static clinic-site
 * bundle: `public/_generated/<slug>/{index.html, css/*, js/site.js, html/*, assets/*, template.json,
 * README.md}`. Same layout `/template-create` produces by hand.
 *
 * The CSS and JS are identical for every site (see `staticAssets.ts`); all per-clinic variation is
 * in the section HTML and in the `--nj-*` custom properties set inline on the `.nj-site` element. */

import type { SiteTemplate } from "./types";
import { CSS, CSS_ORDER, SITE_JS, BOTANICAL_DEFS, ASSET_SVGS } from "./staticAssets";

// --- escaping --------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function telHref(phone: string): string {
  const d = phone.replace(/[^\d+]/g, "");
  return `tel:${d || "0000000000"}`;
}

/** `早めに*気軽に*ご相談` → `早めに<em>気軽に</em>ご相談` (text escaped, one level only). */
function emphasise(line: string): string {
  return line
    .split(/\*([^*]+)\*/)
    .map((part, i) => (i % 2 === 1 ? `<em>${esc(part)}</em>` : esc(part)))
    .join("");
}

// --- icons (medical cards) ----------------------------------------------------

const ICON_INNER: Record<string, string> = {
  skin: '<rect x="4" y="4" width="16" height="16" rx="6"/><circle cx="9.5" cy="10" r="1"/><circle cx="14.7" cy="9" r=".8"/><circle cx="12" cy="15" r="1.4"/>',
  child:
    '<circle cx="9" cy="7" r="3"/><path d="M4 20c0-3.6 2.2-6 5-6s5 2.4 5 6"/><circle cx="16.6" cy="9.6" r="2.3"/><path d="M13.6 20c0-2.7 1.4-4.6 3-4.6s3 1.9 3 4.6"/>',
  sparkle:
    '<circle cx="10" cy="12.5" r="6.5"/><path d="M8 12h.01M12.4 12h.01M8.6 15.5c1.1 1.1 3.7 1.1 4.8 0"/><path d="M18.5 3.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/>',
  care: '<path d="M12 21c5-4 8.5-8 8.5-12A4.5 4.5 0 0 0 12 6.6 4.5 4.5 0 0 0 3.5 9c0 4 3.5 8 8.5 12z"/><path d="M12 9.5v5M9.5 12h5"/>',
  tooth:
    '<path d="M7 3c-2.2 0-3.5 1.8-3.5 4 0 1.6.6 3 .9 5 .3 2 .3 8 2.1 8 1.6 0 1.5-4 2.5-4s.9 4 2.5 4c1.8 0 1.8-6 2.1-8 .3-2 .9-3.4.9-5 0-2.2-1.3-4-3.5-4-1.6 0-2 .8-3 .8S8.6 3 7 3z"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  bone: '<path d="M8 8 4.8 4.8a2.4 2.4 0 1 0-3.4 3.4L4.6 12M8 8l8 8M16 16l3.2 3.2a2.4 2.4 0 1 0 3.4-3.4L19.4 12"/>',
  heart:
    '<path d="M12 20s-7-4.5-9.3-9C1.3 8 3 4.5 6.4 4.5c2 0 3.3 1.2 4.1 2.4C11.3 5.7 12.6 4.5 14.6 4.5 18 4.5 19.7 8 21.3 11 19 15.5 12 20 12 20z"/>',
  allergy:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/><path d="M4 4l2 2M20 4l-2 2M4 20l2-2M20 20l-2-2"/>',
  general: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
};

function icon(name: string): string {
  const inner = ICON_INNER[name] ?? ICON_INNER.general;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const wash = (kind: string) => `<span class="wash wash--${kind}" aria-hidden="true"></span>`;
const botanical = (mod: string, sym: "bot-sprig" | "bot-flower") =>
  `<svg class="botanical botanical--${mod}" aria-hidden="true"><use href="#${sym}"/></svg>`;

function headingBlock(ja: string, en: string): string {
  return `      <div class="heading">
        <span class="en">${esc(en)}</span>
        <h2 class="ja">${esc(ja)}</h2>
      </div>`;
}

// --- structural chrome -----------------------------------------------------

function headerHtml(t: SiteTemplate): string {
  const links = t.nav
    .map((n) => `        <a href="${esc(n.href)}">${esc(n.label)}</a>`)
    .join("\n");
  return `  <header class="site-header">
    <div class="site-header__inner">
      <a class="brand" href="#hero" aria-label="${esc(t.brand.name)}">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4.2"/>
            <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M5.5 18.5l1.8-1.8"/>
          </svg>
        </span>
        <span class="brand__name">
          <span class="brand__ja">${esc(t.brand.name)}</span>
          ${t.brand.nameEn ? `<span class="brand__en">${esc(t.brand.nameEn)}</span>` : ""}
        </span>
      </a>

      <input type="checkbox" id="nj-nav" class="nav-toggle">
      <label for="nj-nav" class="burger" aria-label="メニュー"><span></span></label>

      <nav class="nav">
${links}
      </nav>

      <a class="header-cta" href="${esc(t.contact.reserveUrl)}">${esc(t.contact.reserveLabel)}</a>
    </div>
  </header>`;
}

function railHtml(t: SiteTemplate): string {
  return `  <nav class="rail" aria-label="予約">
    <a href="${esc(t.contact.reserveUrl)}">${esc(t.contact.reserveLabel)}</a>
    <a href="#access">アクセス</a>
  </nav>`;
}

// --- sections ------------------------------------------------------------------

function heroHtml(t: SiteTemplate): string {
  const s = t.sections.hero;
  const src = s.image.src || "assets/hero-art.svg";
  const headline = s.headline.map((l) => `          <span>${emphasise(l)}</span>`).join("\n");
  const bubbles = s.bubbles.length
    ? `
      <ul class="bubbles" data-nj-anim="zoom" aria-label="当院の特長">
${s.bubbles.map((b) => `        <li>${esc(b)}</li>`).join("\n")}
      </ul>`
    : "";
  return `  <section id="hero" class="hero">
    ${wash("pink")}
    ${wash("blue")}
    ${wash("yellow")}
    ${wash("peach")}
    ${botanical("tl", "bot-sprig")}
    ${botanical("br", "bot-flower")}

    <div class="container hero__grid">
      <div class="hero__art" aria-hidden="true"><img src="${esc(src)}" alt=""></div>
      <div class="hero__copy" data-nj-anim>
        <span class="hero__tagline">${esc(s.tagline)}</span>
        <h1 class="hero__headline">
${headline}
        </h1>
        <p class="hero__sub">${esc(s.sub)}</p>
        <div class="hero__cta">
          <a class="btn btn--reserve" href="${esc(t.contact.reserveUrl)}">${esc(t.contact.reserveLabel)}</a>
          <a class="btn btn--tel" href="${telHref(t.contact.phone)}">${esc(t.contact.phone)}</a>
        </div>
      </div>
${bubbles}
    </div>
  </section>`;
}

function greetingHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.greeting;
  const src = s.image.src || "assets/doctor.svg";
  const paras = s.message.map((p) => `          <p>${esc(p)}</p>`).join("\n");
  const sign = s.doctorName
    ? `          <p class="greeting__sign">${esc(t.brand.name)}　${esc(s.doctorRole)}<strong>${esc(s.doctorName)}</strong></p>`
    : "";
  return `  <section id="greeting" class="section ${bg} greeting nj-reveal">
    ${wash("mint")}
    ${botanical("r", "bot-sprig")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <div class="greeting__grid">
        <div class="greeting__figure">
          <img src="${esc(src)}" alt="${esc(s.image.alt)}">
        </div>
        <div class="greeting__body">
${paras}
${sign}
        </div>
      </div>
    </div>
  </section>`;
}

function medicalHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.medical;
  const cards = s.items
    .map(
      (it) => `        <li class="medical__card" data-nj-anim>
          <span class="medical__icon" aria-hidden="true">${icon(it.icon)}</span>
          <h3 class="medical__ja">${esc(it.ja)}<span class="medical__en">${esc(it.en)}</span></h3>
          <p class="medical__lead">${esc(it.lead)}</p>
        </li>`
    )
    .join("\n");
  const conditions = s.conditions.length
    ? `
      <div class="medical__conditions">
        <h3>扱う主な症状</h3>
        <ul class="medical__tags">
${s.conditions.map((c) => `          <li>${esc(c)}</li>`).join("\n")}
        </ul>
      </div>`
    : "";
  const intro = s.intro ? `      <p class="medical__intro">${esc(s.intro)}</p>\n` : "";
  return `  <section id="medical" class="section ${bg} medical nj-reveal">
    ${wash("blue")}
    ${wash("pink")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
${intro}      <ul class="medical__grid">
${cards}
      </ul>${conditions}
    </div>
  </section>`;
}

function philosophyHtml(t: SiteTemplate): string {
  const s = t.sections.philosophy;
  const body = s.body.map((p) => `          <p>${esc(p)}</p>`).join("\n");
  return `  <section id="philosophy" class="section philosophy nj-reveal">
    ${botanical("c", "bot-flower")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <div class="philosophy__inner">
        ${s.lead ? `<p class="philosophy__lead">${esc(s.lead)}</p>` : ""}
        <div class="philosophy__body">
${body}
        </div>
      </div>
    </div>
  </section>`;
}

function galleryHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.gallery;
  const fallbacks = ["assets/room-1.svg", "assets/room-2.svg", "assets/room-3.svg"];
  const items = s.items
    .map(
      (it, i) => `        <li class="gallery__item" data-nj-anim>
          <img src="${esc(it.image.src || fallbacks[i % 3])}" alt="${esc(it.image.alt || it.caption)}">
          <span class="gallery__cap">${esc(it.caption)}</span>
        </li>`
    )
    .join("\n");
  const intro = s.intro ? `      <p class="gallery__intro">${esc(s.intro)}</p>\n` : "";
  return `  <section id="gallery" class="section ${bg} gallery nj-reveal">
    ${wash("peach")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
${intro}      <ul class="gallery__grid">
${items}
      </ul>
    </div>
  </section>`;
}

function scheduleHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.schedule;
  const head = s.days.map((d) => `              <th scope="col">${esc(d)}</th>`).join("\n");
  const rows = s.rows
    .map((r) => {
      const cells = s.days
        .map((_, i) => {
          const m = r.marks[i] ?? "／";
          const tri = m === "▲" || m === "△";
          return `              <td${tri ? ' class="schedule__tri"' : ""}>${esc(m)}</td>`;
        })
        .join("\n");
      return `            <tr>
              <th scope="row">${esc(r.label)}</th>
${cells}
            </tr>`;
    })
    .join("\n");
  const notes = s.notes.length
    ? `
      <ul class="schedule__notes">
${s.notes.map((n) => `        <li>${esc(n)}</li>`).join("\n")}
      </ul>`
    : "";
  return `  <section id="schedule" class="section ${bg} schedule nj-reveal">
    ${wash("yellow")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <div class="schedule__wrap">
        <table class="schedule__table">
          <thead>
            <tr>
              <th class="schedule__corner" scope="col">${esc(s.cornerLabel)}</th>
${head}
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>${notes}
    </div>
  </section>`;
}

function feesHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.fees;
  const groups = s.groups
    .map((g) => {
      const rows = g.items
        .map(
          (it) =>
            `            <div class="fees__row"><dt>${esc(it.name)}${
              it.note ? `<span class="fees__note">${esc(it.note)}</span>` : ""
            }</dt><dd>${esc(it.price)}</dd></div>`
        )
        .join("\n");
      return `        <div class="fees__group" data-nj-anim>
          <h3 class="fees__name">${esc(g.group)}</h3>
          <dl class="fees__list">
${rows}
          </dl>
        </div>`;
    })
    .join("\n");
  return `  <section id="fees" class="section ${bg} fees nj-reveal">
    ${wash("peach")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <div class="fees__groups">
${groups}
      </div>
      <p class="fees__disclaimer">${esc(s.disclaimer)}</p>
    </div>
  </section>`;
}

function flowHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.flow;
  const steps = s.steps
    .map((st) => {
      const n = parseInt(st.no, 10);
      const countAttr = Number.isFinite(n) ? ` data-nj-count="${n}" data-nj-pad="2"` : "";
      return `        <li class="flow__step" data-nj-anim="left">
          <span class="flow__no" aria-hidden="true"${countAttr}>${esc(st.no)}</span>
          <div><h3 class="flow__title">${esc(st.title)}</h3><p class="flow__text">${esc(st.body)}</p></div>
        </li>`;
    })
    .join("\n");
  return `  <section id="flow" class="section ${bg} flow nj-reveal">
    ${wash("mint")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <ol class="flow__list">
${steps}
      </ol>
    </div>
  </section>`;
}

function faqHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.faq;
  const items = s.items
    .map(
      (it) => `        <details class="faq__item" data-nj-anim>
          <summary class="faq__q"><span class="faq__mark faq__mark--q" aria-hidden="true">Q</span><span class="faq__qtext">${esc(
            it.q
          )}</span><span class="faq__chev" aria-hidden="true"></span></summary>
          <div class="faq__a"><span class="faq__mark faq__mark--a" aria-hidden="true">A</span><p>${esc(
            it.a
          )}</p></div>
        </details>`
    )
    .join("\n");
  return `  <section id="faq" class="section ${bg} faq nj-reveal">
    ${wash("pink")}
    <div class="container faq__inner">
${headingBlock(s.heading.ja, s.heading.en)}
      <div class="faq__list">
${items}
      </div>
    </div>
  </section>`;
}

function newsHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.news;
  const items = s.items
    .map(
      (it) =>
        `        <li><time class="news__date">${esc(it.date)}</time><span class="news__title">${esc(
          it.title
        )}</span></li>`
    )
    .join("\n");
  return `  <section id="news" class="section ${bg} news nj-reveal">
    ${botanical("l", "bot-sprig")}
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <ul class="news__list">
${items}
      </ul>
    </div>
  </section>`;
}

function accessHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.access;
  const src = s.image.src || "assets/map.svg";
  const points = s.points.length
    ? `          <ul class="access__points">
${s.points.map((p) => `            <li>${esc(p)}</li>`).join("\n")}
          </ul>`
    : "";
  const info = s.info
    .map(
      (row) =>
        `            <div class="access__info-row"><dt>${esc(row.term)}</dt>${row.lines
          .map((l) => `<dd>${esc(l)}</dd>`)
          .join("")}</div>`
    )
    .join("\n");
  return `  <section id="access" class="section ${bg} access nj-reveal">
    <div class="container">
${headingBlock(s.heading.ja, s.heading.en)}
      <div class="access__grid">
        <div class="access__info-col">
          <p class="access__address">${esc(t.contact.address)}</p>
${points}
          <dl class="access__info">
${info}
          </dl>
          <a class="access__tel" href="${telHref(t.contact.phone)}">${esc(t.contact.phone)}</a>
        </div>
        <div class="access__map">
          <img src="${esc(src)}" alt="${esc(s.image.alt)}">
        </div>
      </div>
    </div>
  </section>`;
}

function contactHtml(t: SiteTemplate, bg: string): string {
  const s = t.sections.contact;
  return `  <section id="contact" class="section ${bg} contact nj-reveal">
    <div class="container">
      <div class="contact__card" data-nj-anim="zoom">
        ${wash("pink")}
        ${wash("blue")}
        <span class="contact__en">${esc(s.heading.en)}</span>
        <h2 class="contact__ja">${esc(s.heading.ja)}</h2>
        <p class="contact__lead">${esc(s.lead)}</p>
        <div class="contact__actions">
          <a class="btn btn--reserve" href="${esc(t.contact.reserveUrl)}">${esc(s.reserveLabel)}</a>
          <a class="contact__tel" href="${telHref(t.contact.phone)}"><small>${esc(
            s.phoneCaption
          )}</small><b>${esc(t.contact.phone)}</b></a>
        </div>
        ${s.note ? `<p class="contact__note">${esc(s.note)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

function footerHtml(t: SiteTemplate): string {
  const s = t.sections.footer;
  const links = s.nav
    .map((n) => `        <a href="${esc(n.href)}">${esc(n.label)}</a>`)
    .join("\n");
  return `  <footer class="site-footer">
    <div class="container site-footer__grid">
      <div>
        <p class="site-footer__name">${esc(t.brand.name)}</p>
        ${t.brand.nameEn ? `<p class="site-footer__en">${esc(t.brand.nameEn)}</p>` : ""}
        <p class="site-footer__addr">${esc(t.contact.address)}</p>
        <a class="site-footer__tel" href="${telHref(t.contact.phone)}">${esc(t.contact.phone)}</a>
      </div>
      <nav class="site-footer__nav">
${links}
      </nav>
    </div>
    <p class="site-footer__copy">${esc(s.copyright)}</p>
  </footer>`;
}

// --- assembly --------------------------------------------------------------

/** Section id → its markup. `bg` alternates paper/tint; philosophy ignores it (gradient band). */
function sectionHtml(id: string, t: SiteTemplate, bg: string): string {
  switch (id) {
    case "hero":
      return heroHtml(t);
    case "greeting":
      return greetingHtml(t, bg);
    case "medical":
      return medicalHtml(t, bg);
    case "philosophy":
      return philosophyHtml(t);
    case "gallery":
      return galleryHtml(t, bg);
    case "schedule":
      return scheduleHtml(t, bg);
    case "fees":
      return feesHtml(t, bg);
    case "flow":
      return flowHtml(t, bg);
    case "faq":
      return faqHtml(t, bg);
    case "news":
      return newsHtml(t, bg);
    case "access":
      return accessHtml(t, bg);
    case "contact":
      return contactHtml(t, bg);
    default:
      return "";
  }
}

/** Walks `layout`, assigning alternating backgrounds. `hero` is structural (own bg); `philosophy`
 * is the gradient band and does not consume a slot in the alternation. */
function laidOutSections(t: SiteTemplate): { id: string; bg: string }[] {
  let paper = true;
  const out: { id: string; bg: string }[] = [];
  for (const { id } of t.layout) {
    if (id === "hero") {
      out.push({ id, bg: "" });
      continue;
    }
    if (id === "philosophy") {
      out.push({ id, bg: "" });
      continue;
    }
    out.push({ id, bg: paper ? "section--paper" : "section--tint" });
    paper = !paper;
  }
  return out;
}

function themeStyleAttr(t: SiteTemplate): string {
  const c = t.theme.colors;
  const w = t.theme.washes;
  return [
    `--nj-primary:${c.primary}`,
    `--nj-primary-deep:${c.primaryDeep}`,
    `--nj-accent:${c.accent}`,
    `--nj-tint:${c.tint}`,
    `--nj-paper:${c.paper}`,
    `--nj-ink:${c.ink}`,
    `--nj-ink-soft:${c.inkSoft}`,
    `--nj-line:${c.line}`,
    `--nj-wash-pink:${w.pink}`,
    `--nj-wash-blue:${w.blue}`,
    `--nj-wash-yellow:${w.yellow}`,
    `--nj-wash-peach:${w.peach}`,
    `--nj-wash-mint:${w.mint}`,
    `--nj-botanical:${t.theme.botanicalStroke}`,
    `--nj-font-head:${t.theme.fonts.heading}`,
    `--nj-font-body:${t.theme.fonts.body}`,
    `--nj-head-tracking:${t.theme.fonts.headingTracking}`,
  ].join("; ");
}

function indexHtml(t: SiteTemplate): string {
  const cssLinks = CSS_ORDER.map((f) => `  <link rel="stylesheet" href="css/${f}">`).join("\n");
  const scale = t.theme.fontScale;
  const scaleStyle =
    typeof scale === "number" && scale !== 1
      ? `  <style>html{font-size:${(16 * scale).toFixed(2)}px}</style>\n`
      : "";
  const sections = laidOutSections(t)
    .map(({ id, bg }) => {
      const marker = `  <!-- ===== ${id} ===== -->`;
      return `${marker}\n${sectionHtml(id, t, bg)}`;
    })
    .join("\n\n");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t.meta.title)}</title>
  <meta name="description" content="${esc(t.meta.description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${esc(t.theme.fonts.googleHref)}">
${cssLinks}
${scaleStyle}  <script src="js/site.js" defer></script>
</head>
<body>
<div class="nj-site" style="${esc(themeStyleAttr(t))}">

${BOTANICAL_DEFS.trimEnd()}

  <div class="nj-progress" aria-hidden="true"></div>

  <!-- ===== header ===== -->
${headerHtml(t)}

${railHtml(t)}

${sections}

  <!-- ===== footer ===== -->
${footerHtml(t)}

</div>
</body>
</html>
`;
}

// --- per-section HTML partials ------------------------------------------------

function partial(comment: string, body: string, t: SiteTemplate): string {
  return `<!-- ${comment} -->
${BOTANICAL_DEFS.trimEnd()}
${headerHtml(t)}
${railHtml(t)}
${body}
`;
}

// --- README ---------------------------------------------------------------

function readme(t: SiteTemplate): string {
  return `# ${t.brand.name} — 生成サイト

ヒアリングシートから OpenAI で本文と画像を生成し、\`/template-create\` と同じ静的バンドル形式で
書き出したものです。

## 構成

- \`index.html\` … 1ページ完結。\`<div class="nj-site" style="--nj-*">\` にテーマ変数を載せています。
- \`css/*.css\` … テーマ変数で駆動する共通スタイル（全サイト同一）。
- \`js/site.js\` … 依存なしの進歩的拡張（スクロール演出・アンカーのヘッダー分オフセット等。無くても表示は成立）。
- \`html/<section>.html\` … セクションごとの断片（先頭にヘッダーメニューを付けた単体利用可の形）。
- \`assets/*.svg\` … 装飾（\`hero-art\`）と、画像が用意できなかったスロットのプレースホルダ。
- \`template.json\` … 生成された構造化データ。文言・色・フォント・セクション順の唯一のソース。

## 直し方

\`template.json\` を編集し、再レンダリング（管理画面から再生成）してください。画像を差し替えるときは
\`sections.*.image.src\`（および \`gallery.items[].image.src\`）を実画像の URL に向けます。

電話・住所・予約 URL は、ヒアリングシートに無い場合ダミー値（\`00-0000-0000\` / \`〒000-0000 …\` /
\`https://lin.ee/0000000\`）のままです。公開前に差し替えてください。
`;
}

// --- entry ---------------------------------------------------------------

export type RenderedBundle = Record<string, string>;

export function renderBundle(t: SiteTemplate): RenderedBundle {
  const files: RenderedBundle = {};

  files["index.html"] = indexHtml(t);
  for (const [name, css] of Object.entries(CSS)) files[`css/${name}`] = css;
  files["js/site.js"] = SITE_JS;
  for (const [name, svg] of Object.entries(ASSET_SVGS)) files[`assets/${name}`] = svg;
  files["template.json"] = JSON.stringify(t, null, 2) + "\n";
  files["README.md"] = readme(t);

  // per-section partials
  files["html/header.html"] = `<!-- ${t.brand.name} / header -->\n${BOTANICAL_DEFS.trimEnd()}\n${headerHtml(
    t
  )}\n${railHtml(t)}\n`;
  files["html/footer.html"] = partial(`${t.brand.name} / footer`, footerHtml(t), t);
  for (const { id, bg } of laidOutSections(t)) {
    files[`html/${id}.html`] = partial(`${t.brand.name} / ${id}`, sectionHtml(id, t, bg), t);
  }

  return files;
}
