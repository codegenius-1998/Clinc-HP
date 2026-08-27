import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./News.module.css";

/** variant: "list" — お知らせ。日付 + 見出しの素朴な一覧。 */
export function NewsList() {
  const { heading, items } = content.news;
  return (
    <section id="news" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} />
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.date}>
              <time className={styles.date}>{item.date}</time>
              <span className={styles.title}>{item.title}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
