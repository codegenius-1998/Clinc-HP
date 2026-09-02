import { site, content } from "../data/template";
import { Container } from "../ui/Container";
import styles from "./Contact.module.css";

const telHref = `tel:${site.phone.replace(/[^\d+]/g, "")}`;

/** variant: "cta" — ご予約・お問い合わせ。淡色の帯に濃紺のカードを置き、予約導線と電話を並べる。
 * 文言はすべて template.json の sections.contact。 */
export function ContactCta() {
  const { heading, lead, reserveLabel, phoneCaption, note } = content.contact;
  return (
    <section id="contact" className={`${styles.section} nj-reveal`}>
      <Container>
        <div className={styles.card} data-nj-anim="zoom">
          <div className={styles.head}>
            <span className={styles.en}>{heading.en}</span>
            <h2 className={styles.ja}>{heading.ja}</h2>
            <p className={styles.lead}>{lead}</p>
          </div>
          <div className={styles.actions}>
            <a href={site.reserveUrl} className={styles.line}>
              {reserveLabel}
            </a>
            <a href={telHref} className={styles.tel}>
              <span className={styles.telLabel}>{phoneCaption}</span>
              <span className={styles.telNo}>{site.phone}</span>
            </a>
          </div>
          <p className={styles.note}>{note}</p>
        </div>
      </Container>
    </section>
  );
}
