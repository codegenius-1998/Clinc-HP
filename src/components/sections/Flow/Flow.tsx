import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Flow.module.css";

/** variant: "steps" — ご来院からの流れ。連番の円 + 見出し + 説明を縦に。円をつなぐ縦線あり。
 * 番号は data-nj-count で 0→N にカウントアップする(JS 無効時は最初から "01" 等が出る)。 */
export function FlowSteps() {
  const { heading, steps } = content.flow;
  return (
    <section id="flow" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" />
        <ol className={styles.list}>
          {steps.map((s) => (
            <li key={s.no} className={styles.step} data-nj-anim="left">
              <span
                className={styles.no}
                aria-hidden
                data-nj-count={String(Number(s.no))}
                data-nj-pad="2"
              >
                {s.no}
              </span>
              <div className={styles.body}>
                <h3 className={styles.title}>{s.title}</h3>
                <p className={styles.text}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
