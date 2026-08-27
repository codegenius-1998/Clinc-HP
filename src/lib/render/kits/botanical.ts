import type { StyleKit } from "./index";

/** すずかけ通り歯科クリニック（`templates/suzukake-dental.json`）の意匠。
 *
 * signature は **蔓（つる）の帯** — セクションの上端を横切る、実と葉を並べた細い一列。CSS の
 * グラデーションだけで描いているので画像ファイルもリクエストも増えず、`var(--primary)` を塗るため
 * クリニックごとの色ずらし（derivePalette）にそのまま追従する。
 *
 * ⚠️ このテンプレートは影を持たない（`block.shadow: "none"`）。平らな面だけで奥行きを作らない設計
 * なので、押せるもの／触れるものの手ざわりは **ホバーの罫と色**が全部引き受ける。ここを削ると、
 * カードとただの箱の区別がつかなくなる。
 *
 * 5つの制約（verify-templates.mts が機械的に測る）と、この中での対応：
 *  1. 動かすのは `.ornament` と擬似要素だけ → 帯の呼吸だけ。`:hover` 以外で文字の箱は動かさない
 *  2. `.nav-toggle` / `nav.site-nav` / ヘッダーの position に触れない → 触れていない
 *  3. 390px で横にはみ出さない → `100vw` も負のマージンも使わない。帯は `.ornament`（inset:0）の中
 *  4. `prefers-reduced-motion` の逃げ道 → 末尾で帯の呼吸とホバーの移動を止める
 *  5. 色はテーマから取る → 生の hex は1つも書かない */

const css = `
/* ── 蔓の帯 ───────────────────────────────────────────────────────────────────────────────────
 * .ornament は site.css が用意した「absolute / inset:0 / pointer-events:none、親は overflow-x:
 * clip」の板。ここに描く限り、装飾は構造的に画面幅を超えられない（制約3）。
 *
 * タイルは 56×26px。1タイルに実（輪）ひとつ・葉ふたつ・芽ひとつを置き、横にだけ繰り返す。
 * 最後の linear-gradient が茎で、background-size を 100% 1px にして1本の細線にしている。
 *
 * ⚠️ 葉は必ず茎に接する高さに置くこと。実測で 3px 離しただけで「蔓」ではなく「針金に通したビーズ」
 * に見えた。植物に見えるかどうかは、形よりも「つながっているか」で決まる。 */
.ornament::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 26px;
  opacity: 0.42;
  background:
    radial-gradient(2.6px 2.6px at 12px 13px, var(--primary) 0 99%, transparent 100%),
    radial-gradient(5.5px 2.6px at 28px 10.3px, var(--primary) 0 99%, transparent 100%),
    radial-gradient(5.5px 2.6px at 40px 15.7px, var(--primary) 0 99%, transparent 100%),
    radial-gradient(1.6px 1.6px at 53px 13px, var(--accent) 0 99%, transparent 100%),
    linear-gradient(var(--primary), var(--primary));
  background-size: 64px 26px, 64px 26px, 64px 26px, 64px 26px, 100% 1px;
  background-position: 0 0, 0 0, 0 0, 0 0, 0 13px;
  background-repeat: repeat-x;
}

/* 淡色のセクションでは帯をもう一段濃く。地色が付いた面だけ密度が上がるので、
 * 同じ柄のまま、ページに強弱がつく。 */
.section-alt .ornament::before { opacity: 0.6; }

/* ヒーローの上には出さない。写真の上に線を引くと、ただの傷に見える。 */
.hero .ornament::before { display: none; }

/* ── 帯の呼吸 ─────────────────────────────────────────────────────────────────────────────────
 * ⚠️ html:not([data-reveal="none"]) の前置きは必須。動きを切ったテンプレートは「全部の動き」を
 * 切っている（site.css の ambient と同じ約束）。
 * 動かすのは background-position だけで、要素そのものは1pxも動かない（制約1・3）。 */
html:not([data-reveal="none"]) .ornament::before {
  animation: kit-vine 60s linear infinite;
}
@keyframes kit-vine {
  from { background-position: 0 0, 0 0, 0 0, 0 0, 0 13px; }
  to   { background-position: 64px 0, 64px 0, 64px 0, 64px 0, 0 13px; }
}

/* ── 触れるものの手ざわり ─────────────────────────────────────────────────────────────────────
 * 影が無いぶん、罫の色と1pxの浮きだけで「押せる」を伝える。
 * transform がかかるのは :hover の間だけなので、静止時のレイアウトも印刷も変わらない。 */
.card {
  transition: border-color 0.25s ease, transform 0.25s ease, background-color 0.25s ease;
}
.card:hover {
  border-color: var(--primary);
  background-color: var(--light);
  transform: translateY(-3px);
}

/* ボタンも同じ考え方。影を足さず、テーマ色の細い輪郭だけを立ち上げる。 */
.btn { transition: box-shadow 0.25s ease, filter 0.25s ease; }
.btn:hover { box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 30%, transparent); }

/* 見出しの下線（site.css の .section h2::after）は既存の演出つき。奪わずに、
 * 見出しの行間だけ蔓の帯ぶん空けて、柄と文字がぶつからないようにする。 */
html[data-kit="botanical"] .section-inner { padding-top: 0.6rem; }

/* ── 見出しと本文の温度差 ─────────────────────────────────────────────────────────────────────
 * このテンプレートの本文色は暖かいグレーで、見出しまで同じ色だと階層が平らになる。見出しだけを
 * ブランド色に寄せて、寒色の見出し／暖色の本文という温度差を作る。
 *
 * ⚠️ var(--primary) ではなく var(--primary-text) を使うこと。前者は「塗りとしての」ブランド色で、
 * 背景に対する読みやすさを保証しない。後者は site/color.ts の readableOn が背景と本文色から導いた
 * 「文字として置いてよい」版で、クリニックごとの色ずらし後も破綻しない。
 * ⚠️ .v-contact-band は色地の帯の上に白文字を置くので除外する。ここを塗ると帯の中で見えなくなる。 */
.section:not(.v-contact-band) h2 { color: var(--primary-text); }

/* ── 動きを望まない人には全部止める（制約4）───────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .ornament::before { animation: none !important; }
  .card:hover { transform: none; }
}
`;

const kit: StyleKit = { css };
export default kit;
