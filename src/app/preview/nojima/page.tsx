import type { Metadata } from "next";
// site.css first, so the shared tokens/resets are bundled BEFORE the section modules
// and a module's own single-class rule always wins on source order.
import "@/components/sections/site.css";
import { layout } from "@/components/sections/data/sections";
import { resolveSection } from "@/components/sections/registry";
import { themeStyle, fontHref, meta } from "@/components/sections/data/template";

/** /preview/nojima — 参考サイト nojima.dental-net.jp の Design DNA から起こした架空の歯科医院
 * サイトのプレビュー。アプリ本体(landing / auth / admin)からは完全に独立していて、
 * スタイルは `.nj-site` 配下にスコープしてある。
 *
 * 文言・画像・フォント・カラーはすべて `src/components/sections/data/template.json` にある。
 * 別のクリニックサイトを作るときは、その JSON を差し替えるだけ(コンポーネントは触らない)。
 * カラーとフォントは下で `.nj-site` にインライン CSS 変数として載せ、site.css の既定値を上書きする。
 *
 * フォントは Google Fonts の <link> で読み込む(next/font を使わないのは、この環境がビルド時に
 * fonts.gstatic.com へ到達できないため)。CDN に届かない場合は site.css のフォールバックに落ちる。
 *
 * 動き(スクロール reveal・進捗バー・ヘッダー影・カウントアップ・スムーズスクロール)は
 * public/nj-motion.js が担う進歩的拡張。読み込めなくてもサイトは完全に成立する。 */

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
};

export default function NojimaPreviewPage() {
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
