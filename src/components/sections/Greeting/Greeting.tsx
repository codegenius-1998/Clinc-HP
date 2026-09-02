import { brand, content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Greeting.module.css";

/** variant: "portrait" — ご挨拶。院長のポートレート + メッセージ + 署名。
 * 画像は template.json の sections.greeting.image。src が無ければグレーのプレースホルダ SVG。 */
export function GreetingPortrait() {
  const { heading, image, doctorName, doctorRole, message } = content.greeting;
  return (
    <section id="greeting" className={`${styles.section} nj-reveal`}>
      <Container className={styles.grid}>
        <div className={styles.figure} aria-hidden>
          {image.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export: no next/image runtime
            <img src={image.src} alt={image.alt} />
          ) : (
            <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
              <rect width="400" height="500" fill="#e4ecf2" />
              <circle cx="200" cy="190" r="70" fill="#c3d0da" />
              <path d="M90 470c0-70 50-120 110-120s110 50 110 120z" fill="#c3d0da" />
            </svg>
          )}
        </div>
        <div className={styles.body}>
          <SectionHeading ja={heading.ja} en={heading.en} />
          {message.map((p, i) => (
            <p key={i} className={styles.para}>
              {p}
            </p>
          ))}
          <p className={styles.sign}>
            {brand.name}　{doctorRole}
            <strong>{doctorName}</strong>
          </p>
        </div>
      </Container>
    </section>
  );
}
