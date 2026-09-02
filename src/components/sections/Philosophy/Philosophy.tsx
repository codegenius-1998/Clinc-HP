import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Philosophy.module.css";

/** variant: "centered" — 当院の理念。青帯の上に白文字で、短い一節を中央に置く。 */
export function PhilosophyCentered() {
  const { heading, lead, body } = content.philosophy;
  return (
    <section className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" onDark />
        <p className={styles.lead}>{lead}</p>
        {body.map((p, i) => (
          <p key={i} className={styles.text}>
            {p}
          </p>
        ))}
      </Container>
    </section>
  );
}
