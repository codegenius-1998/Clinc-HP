import type { ReactNode } from "react";
import styles from "./Container.module.css";

/** サイト共通の中央寄せコンテナ。幅は --nj-container(1100px)に固定。
 * Hero など全幅にしたいセクションは、このコンポーネントを使わずセクション側で全幅にする。 */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.container}${className ? ` ${className}` : ""}`}>{children}</div>;
}
