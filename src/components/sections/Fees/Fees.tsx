import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Fees.module.css";

/** variant: "table" — 料金のめやす。自由診療の代表的な項目を分類ごとに並べる。
 * 金額はすべて template.json の値。保険診療は別である旨を下に注記。カード影なし・髪の毛罫。 */
export function FeesTable() {
  const { heading, groups, disclaimer } = content.fees;
  return (
    <section id="fees" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" />
        <div className={styles.groups}>
          {groups.map((g) => (
            <div key={g.group} className={styles.group} data-nj-anim>
              <h3 className={styles.groupName}>{g.group}</h3>
              <dl className={styles.items}>
                {g.items.map((it) => (
                  <div key={it.name} className={styles.row}>
                    <dt className={styles.name}>
                      {it.name}
                      {it.note ? <span className={styles.note}>{it.note}</span> : null}
                    </dt>
                    <dd className={styles.price}>{it.price}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className={styles.disclaimer}>{disclaimer}</p>
      </Container>
    </section>
  );
}
