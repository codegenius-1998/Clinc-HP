/** 従来の `clinic` の形。中身は `data/template.json` から `data/template.ts` が組み直す。
 * 見出し・ラベル・画像スロットは `content`(= template.ts)を直接使う。 */

export type { Clinic } from "./template";
export { clinic } from "./template";
