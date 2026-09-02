import type { Metadata } from "next";
// site.css first, so the shared tokens/resets are bundled BEFORE the section modules
// and a module's own single-class rule always wins on source order.
import "@/components/sections/site.css";
import { layout } from "@/components/sections/data/sections";
import { resolveSection } from "@/components/sections/registry";
import { themeStyle, fontHref, meta } from "@/components/sections/data/template";

/** /preview/midori — 参考サイト w-kawahifu.com の Design DNA(やわらかい緑・生成りの帯・丸ゴシック・
 * 地域密着で親しみやすい皮膚科)から起こした架空の皮膚科クリニックのプレビュー。
 *
 * 文言・画像・フォント・カラーはすべて `src/components/sections/data/template.json` にある。
 * カラーとフォントは下で `.nj-site` にインライン CSS 変数として載り、site.css の既定値を上書きする。
 * 動きは public/nj-motion.js の進歩的拡張(読み込めなくても表示は成立する)。 */

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
};

export default function MidoriPreviewPage() {
  return (
    <div className="nj-site" style={themeStyle}>
      {fontHref ? (
        <>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontHref} data-nj-font />
        </>
      ) : null}
      <div className="nj-progress" aria-hidden />
      {layout.map(({ type, variant }, i) => {
        const Section = resolveSection(type, variant);
        return Section ? <Section key={`${type}-${i}`} /> : null;
      })}
      {/* 進歩的拡張。CSP でインライン不可なので外部ファイルで読む。無くても表示は成立する。 */}
      <script src="/nj-motion.js" defer />
    </div>
  );
}
