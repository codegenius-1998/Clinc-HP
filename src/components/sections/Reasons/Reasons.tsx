import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import { Illustration } from "../ui/Illustration";
import styles from "./Reasons.module.css";

/** variant: "numbered" — 「選ばれる理由」。カード化せず、連番と罫線で見せる(参考サイト踏襲)。
 * 各理由にイラスト(inline SVG 線画)を添える。件数・文言・アイコンは template.json。 */
export function ReasonsNumbered() {
  const { heading, items } = content.reasons;
  return (
    <section id="reasons" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" />
        <ol className={styles.list}>
          {items.map((r) => (
            <li key={r.no} data-nj-anim="left">
              <span className={styles.lead} aria-hidden>
                <Illustration name={r.icon} className={`${styles.illus} nj-float`} />
                <span className={styles.no}>
                  <span className={styles.noLabel}>point</span>
                  {r.no}
                </span>
              </span>
              <div className={styles.body}>
                <h3 className={styles.title}>{r.title}</h3>
                <p className={styles.text}>{r.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
