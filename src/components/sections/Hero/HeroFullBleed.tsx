import { site, content, splitEmphasis } from "../data/template";
import styles from "./HeroFullBleed.module.css";

const telHref = `tel:${site.phone.replace(/[^\d+]/g, "")}`;

/** variant: "full-bleed" — 実写を全幅で敷き、見出しを写真の上に重ねる。
 * 写真は template.json の sections.hero.image。src が無ければグレーのプレースホルダ SVG。
 * 見出しは headlineLines(1 行 1 要素、`*…*` がアクセント色)。 */
export function HeroFullBleed() {
  const { image, headlineLines, sub, reserveLabel } = content.hero;
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.media} aria-hidden data-nj-parallax>
        {image.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export: no next/image runtime
          <img className={styles.ph} src={image.src} alt={image.alt} />
        ) : (
          <svg className={styles.ph} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
            <rect width="1600" height="900" fill="#dfe7ee" />
            <g fill="none" stroke="#b9c6d2" strokeWidth="6" strokeLinejoin="round">
              <rect x="640" y="330" width="320" height="230" rx="12" />
              <path d="M664 520l84-88 62 62 54-50 84 76" />
            </g>
            <circle cx="740" cy="392" r="22" fill="#b9c6d2" />
          </svg>
        )}
      </div>

      <div className={styles.scrim} aria-hidden />

      <span className={styles.sparkles} aria-hidden>
        <i className="nj-spark" />
        <i className="nj-spark" />
        <i className="nj-spark" />
        <i className="nj-spark" />
      </span>

      <div className={styles.copy}>
        <h1 className={styles.headline} data-nj-anim>
          {headlineLines.map((line, i) => (
            <span key={i}>
              {splitEmphasis(line).map((tok, j) =>
                tok.em ? <em key={j}>{tok.text}</em> : <span key={j}>{tok.text}</span>
              )}
            </span>
          ))}
        </h1>
        <p className={styles.sub} data-nj-anim>
          {sub}
        </p>
        <div className={styles.actions} data-nj-anim>
          <a href={site.reserveUrl} className={styles.reserve}>
            {reserveLabel}
          </a>
          <a href={telHref} className={styles.tel}>
            {site.phone}
          </a>
        </div>
      </div>

      <span className={styles.scroll} aria-hidden />
    </section>
  );
}
