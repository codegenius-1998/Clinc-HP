import { site, content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Access.module.css";

/** variant: "map-side" — アクセス。住所・案内を左、地図を右に。
 * 地図画像は template.json の sections.access.image。src が無ければプレースホルダ SVG。 */
export function AccessMapSide() {
  const { heading, image, points, info } = content.access;
  return (
    <section id="access" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} />
        <div className={styles.grid}>
          <div className={styles.info}>
            <p className={styles.address}>{site.address}</p>
            <ul className={styles.points}>
              {points.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <dl className={styles.hours}>
              {info.map((row) => (
                <div key={row.term} className={styles.hoursRow}>
                  <dt>{row.term}</dt>
                  {row.lines.map((line) => (
                    <dd key={line}>{line}</dd>
                  ))}
                </div>
              ))}
            </dl>
            <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className={styles.tel}>
              {site.phone}
            </a>
          </div>
          <div className={styles.map} aria-hidden>
            {image.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export: no next/image runtime
              <img src={image.src} alt={image.alt} />
            ) : (
              <svg viewBox="0 0 600 460" preserveAspectRatio="xMidYMid slice">
                <rect width="600" height="460" fill="#e7edf2" />
                <path d="M0 300h600M240 0v460M0 140h600" stroke="#cdd8e0" strokeWidth="8" />
                <circle cx="300" cy="220" r="16" fill="var(--nj-primary)" />
                <path
                  d="M300 236c-14 22-30 26-30 44a30 30 0 0 0 60 0c0-18-16-22-30-44z"
                  fill="var(--nj-primary)"
                />
              </svg>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
