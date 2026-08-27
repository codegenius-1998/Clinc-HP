import { clinic } from "../data/clinic";
import styles from "./HeroSplit.module.css";

const telHref = `tel:${clinic.phone.replace(/[^\d+]/g, "")}`;

/** variant: "split" — full-bleed の差し替え候補。写真と文字を左右に分ける編集的な型。
 * registry.ts で hero の variant を "split" にすれば入れ替わる(同じ役割・別デザイン)。 */
export function HeroSplit() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.figure} aria-hidden>
          <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
            <rect width="800" height="600" fill="#dfe7ee" />
            <g fill="none" stroke="#b9c6d2" strokeWidth="6" strokeLinejoin="round">
              <rect x="300" y="210" width="200" height="150" rx="10" />
              <path d="M316 340l50-52 40 40 34-30 44 42" />
            </g>
            <circle cx="360" cy="256" r="16" fill="#b9c6d2" />
          </svg>
        </div>
        <div className={styles.copy}>
          <h1 className={styles.headline}>
            早めに<em>気づいて</em>、<br />
            負担を<em>小さく</em>
          </h1>
          <p className={styles.sub}>
            買い物のついでに寄れる歯科医院を目指しています。診療時間・休診日はこのページでご確認いただけます。
          </p>
          <div className={styles.actions}>
            <a href={clinic.lineUrl} className={styles.reserve}>
              LINE予約
            </a>
            <a href={telHref} className={styles.tel}>
              {clinic.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
