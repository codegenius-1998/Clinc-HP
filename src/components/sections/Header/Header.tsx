import { brand, site, nav, actionBar } from "../data/template";
import styles from "./Header.module.css";

const telHref = `tel:${site.phone.replace(/[^\d+]/g, "")}`;

/** 特殊トークンを実 URL に。"tel" → 電話, "reserve" → 予約 URL, それ以外はそのまま。 */
function resolveHref(href: string): string {
  if (href === "tel") return telHref;
  if (href === "reserve") return site.reserveUrl;
  return href;
}

/** variant: "bar" — 参考サイトの横バー型ヘッダー。メニュー項目は template.json の `nav`
 * (= ページのセクションと1対1)。モバイルメニューは CSS のみ(チェックボックス + 兄弟結合子)。 */
export function HeaderBar() {
  const { logo } = brand;
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="#top" className={styles.brand} aria-label={brand.name}>
          <span className={styles.mark} aria-hidden>
            {logo.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export: no next/image runtime
              <img src={logo.src} alt="" width={40} height={40} />
            ) : (
              // 診療科に依存しない中立のマーク。実サイトは template.json の brand.logo.src を指定する。
              <svg viewBox="0 0 40 40" width="40" height="40">
                <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--nj-primary)" />
                <path
                  d="M20 11v18M11 20h18"
                  stroke="#fff"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className={styles.name}>
            <span className={styles.nameJa}>{brand.name}</span>
            <span className={styles.nameEn}>{brand.nameEn}</span>
          </span>
        </a>

        <a href={telHref} className={styles.tel}>
          <span className={styles.telLabel}>{site.phoneCaption}</span>
          <span className={styles.telNo}>{site.phone}</span>
        </a>

        <input type="checkbox" id="nj-nav" className={styles.toggle} />
        <label htmlFor="nj-nav" className={styles.burger} aria-label="メニュー">
          <span />
        </label>

        <nav className={styles.nav}>
          <ul>
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href}>
                  <span className={styles.navJa}>{item.ja}</span>
                  <span className={styles.navEn}>{item.en}</span>
                </a>
              </li>
            ))}
          </ul>
          <a href={site.reserveUrl} className={styles.reserve}>
            {site.reserveLabel}
          </a>
        </nav>
      </div>

      {/* モバイル専用の固定アクションバー */}
      <div className={styles.actionBar}>
        {actionBar.map((a) => (
          <a
            key={a.label}
            href={resolveHref(a.href)}
            className={a.href === "reserve" ? styles.actionReserve : undefined}
          >
            {a.label}
          </a>
        ))}
      </div>
    </header>
  );
}
