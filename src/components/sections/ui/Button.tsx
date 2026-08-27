import type { ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "reserve" | "tel" | "ghost";

/** 予約導線のボタン。参考サイトに合わせてフラット(影なし)、角丸は控えめ。
 *  - reserve … 白地(LINE予約)
 *  - tel … 青の塗り(電話)
 *  - ghost … 白地に青の輪郭 */
export function Button({
  href,
  variant = "reserve",
  children,
  block = false,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  block?: boolean;
}) {
  return (
    <a
      href={href}
      className={`${styles.btn} ${styles[variant]}${block ? ` ${styles.block}` : ""}`}
    >
      {children}
    </a>
  );
}
