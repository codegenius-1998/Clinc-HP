import styles from "./SectionHeading.module.css";

/** 参考サイトの見出し様式 = 和文(大・丸ゴシック・広めの字間) + 英字(小・青)の2段。
 * `align="center"` で中央寄せ。`onDark` で色を反転(青帯の上で使う)。
 * 見出しの上に小さな「きらきら」を3つ(CSS アニメ、reduced-motion では静止)。 */
export function SectionHeading({
  ja,
  en,
  align = "left",
  onDark = false,
}: {
  ja: string;
  en: string;
  align?: "left" | "center";
  onDark?: boolean;
}) {
  return (
    <div className={`${styles.wrap} ${styles[align]}${onDark ? ` ${styles.onDark}` : ""}`}>
      <span className={styles.sparkles} aria-hidden>
        <i className="nj-spark" />
        <i className="nj-spark" />
        <i className="nj-spark" />
      </span>
      <h2 className={styles.ja}>{ja}</h2>
      <span className={styles.en}>{en}</span>
    </div>
  );
}
