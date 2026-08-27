/** セクション構成は `data/template.json` の `layout` が唯一の真実。ここは型と再エクスポートのみ。
 * type と variant を分離してあるので、同じ役割のセクションを別デザインに差し替えるのは
 * variant を変えるだけ(registry.ts が解決する)。 */

export type { SectionType, SectionConfig } from "./template";
export { layout } from "./template";
