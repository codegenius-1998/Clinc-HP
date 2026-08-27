import { brand, site, content } from "../data/template";
import { Container } from "../ui/Container";
import styles from "./Footer.module.css";

/** variant: "band" — 濃い青の帯。医院名・住所・ナビ・著作権表示。ナビ・著作権は template.json。 */
export function FooterBand() {
  const { nav, copyright } = content.footer;
  return (
    <footer className={styles.footer}>
      <Container className={styles.grid}>
        <div>
          <p className={styles.name}>{brand.name}</p>
          <p className={styles.nameEn}>{brand.nameEn}</p>
          <p className={styles.address}>{site.address}</p>
          <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className={styles.tel}>
            {site.phone}
          </a>
        </div>
        <nav className={styles.nav}>
          {nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
      </Container>
      <p className={styles.copy}>{copyright}</p>
    </footer>
  );
}
