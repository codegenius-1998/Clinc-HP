import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Faq.module.css";

/** variant: "accordion" — よくある質問。<details>/<summary> の CSS のみのアコーディオン
 * (開閉に JS は不要)。Q/A のマークと、開くと回転する山形。 */
export function FaqAccordion() {
  const { heading, items } = content.faq;
  return (
    <section id="faq" className={`${styles.section} nj-reveal`}>
      <Container className={styles.inner}>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" />
        <div className={styles.list}>
          {items.map((f, i) => (
            <details key={i} className={styles.item} data-nj-anim>
              <summary className={styles.q}>
                <span className={styles.qMark} aria-hidden>
                  Q
                </span>
                <span className={styles.qText}>{f.q}</span>
                <span className={styles.chev} aria-hidden />
              </summary>
              <div className={styles.a}>
                <span className={styles.aMark} aria-hidden>
                  A
                </span>
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
