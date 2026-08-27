import type { StyleKit } from "./index";

/** 「きらきら」— a field of fine points of light that drift and twinkle behind each section, plus two
 * small interactions (a card that lifts under the pointer, a button whose light sweeps on hover).
 *
 * ⚠️ This is also the WORKED EXAMPLE the template-from-url skill points at. Every rule below obeys
 * the five constraints a kit must obey, and each one is annotated with which. Copy this file as the
 * starting point for a new kit rather than starting from an empty one.
 *
 * The five constraints, in full:
 *  1. Only `.ornament` and pseudo-elements may be animated. Never a box that contains text — a moving
 *     text box is what reintroduces the 390px horizontal-scroll bug and what makes a page unreadable
 *     to someone with vestibular sensitivity.
 *  2. Never touch `.nav-toggle`, `nav.site-nav`, or the header's position. The mobile menu is
 *     `.nav-toggle:checked ~ nav.site-nav` — a sibling combinator — so lifting the header out of flow
 *     kills the menu on every page of every site built from the template.
 *  3. Nothing may be wider than its container at 390px. No negative margins, no `100vw`, no
 *     `translateX` on anything in flow.
 *  4. Every animation needs a `prefers-reduced-motion: reduce` escape. ⚠️ The global
 *     `animation-duration: 0.01ms` override does NOT stop `background-attachment: fixed` or any value
 *     a script writes, so those have to be switched off by hand.
 *  5. Colours come from the theme (`var(--primary)`, `var(--accent)`, `var(--bg)`). A literal hex
 *     here would survive `derivePalette`'s per-clinic hue rotation and drift out of the palette. */

const css = `
/* ── きらきらの層 ─────────────────────────────────────────────────────────────────────────────
 * .ornament は site.css が「absolute / inset:0 / pointer-events:none」で用意した空の板。
 * 親の .section は overflow-x: clip なので、ここに何を描いても横には出られない（制約3）。 */
.ornament {
  background:
    radial-gradient(circle at 12% 22%, var(--primary) 0 1.4px, transparent 1.6px),
    radial-gradient(circle at 68% 14%, var(--accent) 0 1.1px, transparent 1.3px),
    radial-gradient(circle at 34% 71%, var(--primary) 0 1.7px, transparent 1.9px),
    radial-gradient(circle at 87% 58%, var(--accent) 0 1.2px, transparent 1.4px),
    radial-gradient(circle at 52% 40%, var(--primary) 0 1px, transparent 1.2px);
  background-size: 260px 220px, 340px 300px, 210px 190px, 300px 260px, 170px 150px;
  background-repeat: repeat;
  opacity: 0.5;
}

/* 二枚目の層。::before で重ねると位相をずらせるので、粒がぶつからずに散らばって見える。
 * ::before/::after は擬似要素なので制約1を満たす。 */
.ornament::before,
.ornament::after {
  content: "";
  position: absolute;
  inset: 0;
  background: inherit;
  background-position: 40% 60%;
}
/* ⚠️ --kit-scroll は下の JS が書く 0〜1。読み下すほど粒が増えていく。
 * var() のフォールバックを必ず書くこと — JS が動かない環境（スクリプト無効、reduced-motion）でも
 * 破綻しないのが、JS を使う装飾の最低条件。 */
.ornament::after {
  background-position: 75% 25%;
  filter: blur(1px);
  opacity: calc(0.35 + var(--kit-scroll, 0) * 0.5);
}

/* ── 瞬きと漂い ───────────────────────────────────────────────────────────────────────────────
 * html:not([data-reveal="none"]) の前置きは必須。動きを切ったテンプレートは「全部の動き」を
 * 切っている（site.css の ambient と同じ規則）。 */
html:not([data-reveal="none"]) .ornament {
  animation: kit-twinkle 5.5s ease-in-out infinite;
}
html:not([data-reveal="none"]) .ornament::before {
  animation: kit-twinkle 7.5s ease-in-out infinite reverse;
}
html:not([data-reveal="none"]) .ornament::after {
  animation: kit-drift 24s linear infinite;
}

@keyframes kit-twinkle {
  0%, 100% { opacity: 0.28; }
  50%      { opacity: 0.62; }
}
/* 動かすのは background-position だけ。要素そのものは1pxも動かない（制約1・3）。 */
@keyframes kit-drift {
  from { background-position: 75% 25%; }
  to   { background-position: 75% -75%; }
}

/* ── ホバーのふるまい ─────────────────────────────────────────────────────────────────────────
 * カードは静止時に一切ずれない。transform がかかるのは :hover の間だけなので、
 * レイアウトにも印刷にも影響しない。 */
.card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
.card:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.13); }

/* ボタンの光。site.css の .btn::after（既存の shine）と同じ層を使い回さず、
 * ふちの明かりだけを足す。 */
.btn { transition: box-shadow 0.3s ease, transform 0.25s ease; }
.btn:hover { box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 28%, transparent); }

/* ── 動きを望まない人には全部止める（制約4）─────────────────────────────────────────────────
 * ⚠️ scroll 連動で JS が書き込む --kit-scroll も、ここで既定値に固定する。
 *   一括指定の animation-duration: 0.01ms では止まらないため。 */
@media (prefers-reduced-motion: reduce) {
  .ornament,
  .ornament::before,
  .ornament::after { animation: none !important; }
  .card:hover { transform: none; }
  :root { --kit-scroll: 0; }
}
`;

/** ⚠️ Writes a custom property and nothing else. It never moves an element, never inserts markup and
 * never reads anything off the page — so the worst a bug here can do is leave the sparkle field at a
 * constant brightness. `main.js` already owns the reveal observer and the scroll progress bar; a kit
 * that re-implemented either would fight it. */
const js = `
// スクロール位置（0〜1）を --kit-scroll に書き、CSS 側で明るさに使う。
// ⚠️ 動きを望まない設定のときは何も書かない。CSS の @media 側で 0 に固定してあるので、
//    ここで早期に return するだけで完全に止まる。
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var root = document.documentElement;
  var ticking = false;
  function update() {
    var max = document.body.scrollHeight - window.innerHeight;
    root.style.setProperty("--kit-scroll", max > 0 ? String(window.scrollY / max) : "0");
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();
})();
`;

const kit: StyleKit = { css, js };
export default kit;
