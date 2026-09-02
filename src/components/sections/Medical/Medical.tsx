import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import { Illustration } from "../ui/Illustration";
import styles from "./Medical.module.css";

/** variant: "grid" — 診療案内。和文 + 英字 + 一言のカードを格子で。
 * 各カードにイラスト(inline SVG 線画)を添える。フラット(影なし)、髪の毛罫の枠。 */
export function MedicalGrid() {
  const { heading, items } = content.medical;
  return (
    <section id="medical" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" />
        <ul className={styles.grid}>
          {items.map((t) => (
            <li key={t.key} className={styles.card} data-nj-anim="zoom">
              <span className={styles.icon} aria-hidden>
                <Illustration name={t.icon} className={`${styles.iconSvg} nj-float`} />
              </span>
              <h3 className={styles.ja}>{t.ja}</h3>
              <span className={styles.en}>{t.en}</span>
              <p className={styles.lead}>{t.lead}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
