import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { TemplateShowcase, type ShowcaseEntry } from "@/components/landing/TemplateShowcase";
import { IconImage, IconRuler, IconShield, IconWriting } from "@/components/landing/icons";

/** The public landing page — the product's own face, and the only screen here a clinic sees before
 * deciding to sign up. It used to be the login form, which told a first-time visitor nothing.
 *
 * Reading the session serves two purposes: someone already signed in gets sent to their own pages
 * rather than being asked to sign in again, and touching cookies keeps this route dynamic. The
 * second matters more than it looks — a statically prerendered version would try to reach D1 during
 * `next build`, on a machine that may have no credentials, and bake in whatever it found.
 *
 * ## Where the pictures come from
 *
 * Two sources, and the split is deliberate.
 *
 * The photographs (`/landing/*.jpg`) are generated — `scripts/generate-landing-assets.mts`. A page
 * whose whole argument is "you do not need to commission photography" cannot itself be built on
 * licensed stock, and generating them also leaves the page free of third-party image rights.
 *
 * The pictures of homepages (`/landing/templates/*.jpg`) are NOT generated. They are real screenshots
 * of real renders, taken by `scripts/shoot-templates.mts`, together with the measured position of
 * every section in them. Asking an image model to draw "a clinic website" produces a convincing
 * picture of a page this app cannot build — which is a promise the product then fails to keep.
 *
 * ⚠️ The showcase deliberately lists TEMPLATES, never generated clinic sites. Those belong to real
 * clinics, and putting one on a sales page is a permission question, not a design decision.
 *
 * ⚠️ No price appears anywhere on this page. There is no pricing in the system to read one from, and
 * a number invented here is a number a customer can hold us to. */

const SHOWCASE_MANIFEST = path.join(process.cwd(), "public", "landing", "templates.json");

/** Written by scripts/shoot-templates.mts. Missing or unreadable is a normal state — a fresh clone
 * has no screenshots — and simply hides the showcase rather than failing the page. */
async function loadShowcase(): Promise<ShowcaseEntry[]> {
  try {
    const raw = await readFile(SHOWCASE_MANIFEST, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ShowcaseEntry[]) : [];
  } catch {
    return [];
  }
}

const STATS = [
  { value: 10, suffix: "", unit: "ステップ", label: "入力するのはこれだけ", note: "医院の基本情報から料金表まで" },
  { value: 4, suffix: "", unit: "分ほど", label: "作成にかかる時間", note: "文章と画像をまとめて用意します" },
  { value: 13, suffix: "", unit: "セクション", label: "できあがるページの中身", note: "診療案内からアクセスまで一式" },
  { value: 2, suffix: "", unit: "つの検査", label: "公開前に自動でかける", note: "医療広告の表現と、表示の崩れ" },
];

const FEATURES = [
  {
    Icon: IconWriting,
    n: "01",
    title: "文章を、書かなくていい",
    body: "キャッチコピーも、診療案内の説明文も、院長のご挨拶も。ご入力いただいた事実をもとにAIが下書きします。埋めていただくのは事実だけです。",
  },
  {
    Icon: IconImage,
    n: "02",
    title: "写真が、なくてもいい",
    body: "院内の写真をお持ちでなくても構いません。文字と余白だけで成立するデザインをご用意しています。お手元に写真があれば、そちらを優先して使います。",
  },
  {
    Icon: IconShield,
    n: "03",
    title: "医療広告の表現を確認",
    body: "「地域No.1」「必ず治る」といった、医療広告ガイドライン上で問題になりうる言い回しがないか、公開前にAIが読んで指摘します。",
  },
  {
    Icon: IconRuler,
    n: "04",
    title: "表示崩れを機械が検査",
    body: "スマートフォンで横にはみ出していないか、画像が抜けていないか、文字が読める色か。実際にブラウザで開いて測っています。",
  },
];

const FLOW = [
  {
    n: "01",
    image: "/landing/flow-01.jpg",
    title: "10の質問に答える",
    body: "医院名、住所、診療時間、スタッフ、料金。お手元にある情報を順に入力します。途中で保存できるので、一度に終わらせる必要はありません。",
  },
  {
    n: "02",
    image: "/landing/flow-02.jpg",
    title: "AIがページを組み立てる",
    body: "医院の雰囲気に合うデザインの型をAIが選び、文章と画像をまとめて用意します。電話番号・住所・診療時間・料金は、いただいた内容をそのまま載せます。",
  },
  {
    n: "03",
    image: "/landing/flow-03.jpg",
    title: "手直しして、公開する",
    body: "できあがったページは画面上で直接編集できます。直したい文字をクリックして書き換え、そのまま公開できます。",
  },
];

const ASSURANCES = [
  {
    label: "事実は、創作しません",
    body: "電話番号・住所・診療時間・料金・スタッフ・よくある質問は、ヒアリングシートの内容をそのまま載せます。AIが書けるのは、お知らせとよくある質問を一件もご入力いただかなかった場合の下書きだけです。",
  },
  {
    label: "公開の前に、二重に見ます",
    body: "医療広告として問題になりうる表現がないかをAIが読み、同時に、実際のブラウザでページを開いて表示の崩れを測ります。どちらも人の目に頼りません。",
  },
  {
    label: "あとから、何度でも直せます",
    body: "作って終わりではありません。診療時間が変わっても、スタッフが増えても、画面上で書き換えてすぐ公開できます。",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  const showcase = await loadShowcase();

  const signedInHref = session?.role === "admin" ? "/admin/dashboard" : session ? "/home" : null;
  const heroShot = showcase[0];

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <LandingHeader signedInHref={signedInHref} />

      <main className="flex-1">
        {/* ── Hero ────────────────────────────────────────────────────────────────
            A photograph with the left third deliberately left empty — the image was generated to
            that brief so the headline sits on flat wall rather than on furniture, and stays legible
            without needing a scrim heavy enough to muddy the picture. */}
        <section className="relative isolate overflow-hidden bg-ink">
          <div className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image's wrapper fights the
                scroll-driven transform on .parallax-slow; this is one known-size hero photograph. */}
            <img
              src="/landing/hero.jpg"
              alt=""
              width={1536}
              height={1024}
              fetchPriority="high"
              className="parallax-slow h-full w-full object-cover object-[70%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/55 to-ink/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-ink/35" />
          </div>

          <div className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-36 sm:pt-44 lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] lg:items-center lg:pb-32">
            <div>
              <Reveal>
                <p className="text-[11px] tracking-[0.4em] text-white/70">CLINIC HOMEPAGE STUDIO</p>
                <h1 className="mt-8 font-display text-[34px] leading-[1.55] tracking-[0.06em] text-white sm:text-[50px] sm:leading-[1.45]">
                  クリニックの
                  <br />
                  ホームページを、
                  <br />
                  {/* Underlined rather than highlighted. The marker stroke used in the sections
                      below needs a pale band behind dark text; over a photograph, with white text on
                      it, the same band reads as a grey box rather than a mark. */}
                  <span className="relative inline-block">
                    10の質問
                    <span aria-hidden className="draw-line absolute -bottom-1.5 left-0 block h-[3px] w-full bg-highlight" />
                  </span>
                  から。
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-9 max-w-xl border-l border-white/25 pl-5 text-[15px] leading-[2.1] text-white/80">
                  医院名、診療時間、スタッフ、料金。お手元にある情報を順に入力するだけで、文章も写真もそろった一式のホームページができあがります。できたページは、その場で書き換えて公開できます。
                </p>
              </Reveal>

              <Reveal delay={220} className="mt-11 flex flex-wrap items-center gap-x-5 gap-y-4">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-paper px-8 py-4 text-[14px] font-medium text-ink transition-transform duration-300 hover:-translate-y-0.5"
                >
                  無料ではじめる
                  <span aria-hidden className="arrow-slide">
                    →
                  </span>
                </Link>
                <a
                  href="#showcase"
                  className="group inline-flex items-center gap-3 rounded-full border border-white/35 px-8 py-4 text-[14px] text-white transition-colors duration-300 hover:bg-white/10"
                >
                  できあがるものを見る
                  <span aria-hidden className="arrow-slide">
                    ↓
                  </span>
                </a>
              </Reveal>
            </div>

            {/* The laptop. Real screenshot of a real template — see the note at the top of the file. */}
            {heroShot && (
              <Reveal delay={320} move="scale" className="hidden lg:block">
                <div className="float-soft">
                  <div className="overflow-hidden rounded-xl border border-white/15 bg-white/10 p-2 shadow-[0_50px_90px_-40px_rgb(0_0_0/0.7)] backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    </div>
                    <div className="overflow-hidden rounded-md bg-paper" style={{ aspectRatio: "1360 / 900" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                      <img
                        src={heroShot.desktop.src}
                        alt={`${heroShot.name}の見本`}
                        width={heroShot.desktop.width}
                        height={heroShot.desktop.height}
                        className="w-full max-w-none"
                      />
                    </div>
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center">
            <span aria-hidden className="cue-drop text-[11px] tracking-[0.3em] text-white/70">
              SCROLL
            </span>
          </div>
        </section>

        {/* ── Numbers ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-line bg-canvas">
          {/* ⚠️ The padding is on the wrapper, not on the grid. `gap-px bg-line` paints the grid's
              whole box, so a grid that carried the padding itself showed the hairline colour as a
              stripe down the outside of the first and last cell. */}
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 90} className="bg-canvas px-2 py-11 sm:px-7">
                  <p className="text-[12px] tracking-[0.22em] text-ink-soft">{stat.label}</p>
                  <p className="mt-4 flex items-baseline gap-2 text-brand">
                    <CountUp value={stat.value} className="font-display text-[42px] leading-none tabular-nums" />
                    <span className="font-display text-[15px] tracking-[0.08em]">{stat.unit}</span>
                  </p>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">{stat.note}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────────── */}
        <section id="features" className="grid-field scroll-mt-20 border-b border-line bg-paper">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <Reveal>
              <p className="text-[11px] tracking-[0.4em] text-brand">FEATURES</p>
              <h2 className="mt-5 font-display text-[27px] leading-[1.6] tracking-[0.1em] text-ink sm:text-[34px]">
                手が回らないところを、
                <br className="sm:hidden" />
                <span className="marker">まるごと引き受けます</span>。
              </h2>
              <span aria-hidden className="draw-line mt-9 block h-px w-24 bg-brand" />
            </Reveal>

            <div className="mt-14 grid gap-px bg-line sm:grid-cols-2">
              {FEATURES.map((feature, i) => (
                <Reveal
                  key={feature.n}
                  delay={(i % 2) * 110}
                  move={i % 2 === 0 ? "left" : "right"}
                  className="lift group flex flex-col border border-transparent bg-paper px-7 py-10 sm:px-9"
                >
                  <div className="flex items-center justify-between">
                    <feature.Icon className="h-11 w-11 text-brand" />
                    <span className="font-display text-[13px] tracking-[0.2em] text-ink-soft/50">{feature.n}</span>
                  </div>
                  <h3 className="mt-7 font-display text-[19px] tracking-[0.08em] text-ink">{feature.title}</h3>
                  <p className="mt-4 text-[14px] leading-[2] text-ink-soft">{feature.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Showcase ────────────────────────────────────────────────────────── */}
        {showcase.length > 0 && (
          <section id="showcase" className="scroll-mt-20 border-b border-line bg-canvas">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
              <Reveal>
                <p className="text-[11px] tracking-[0.4em] text-brand">WHAT YOU GET</p>
                <h2 className="mt-5 font-display text-[27px] leading-[1.6] tracking-[0.1em] text-ink sm:text-[34px]">
                  できあがるのは、
                  <br className="sm:hidden" />
                  <span className="marker">この一式</span>です。
                </h2>
                <p className="mt-7 max-w-2xl text-[14px] leading-[2] text-ink-soft">
                  下に並んでいるのは、実際にこのサービスが出力したページをそのまま撮ったものです。見たいところを選ぶと、その場所までスクロールします。
                  ご入力いただいた診療科や医院の雰囲気に合わせて、AIがこの型の中から選びます。同じ型でも、セクションの見せ方と配色は医院ごとに変わります。
                </p>
                <span aria-hidden className="draw-line mt-9 block h-px w-24 bg-brand" />
              </Reveal>

              <Reveal delay={120} className="mt-14">
                <TemplateShowcase entries={showcase} />
              </Reveal>
            </div>
          </section>
        )}

        {/* ── Flow ────────────────────────────────────────────────────────────── */}
        <section id="flow" className="scroll-mt-20 border-b border-line bg-paper">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <Reveal>
              <p className="text-[11px] tracking-[0.4em] text-brand">FLOW</p>
              <h2 className="mt-5 font-display text-[27px] leading-[1.6] tracking-[0.1em] text-ink sm:text-[34px]">
                制作の流れ
              </h2>
              <span aria-hidden className="draw-line mt-9 block h-px w-24 bg-brand" />
            </Reveal>

            <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
              {FLOW.map((step, i) => (
                <Reveal key={step.n} delay={i * 130} className="group flex flex-col">
                  <div className="zoom-frame relative overflow-hidden bg-canvas" style={{ aspectRatio: "4 / 3" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- see the note at the top */}
                    <img
                      src={step.image}
                      alt=""
                      width={1024}
                      height={1024}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-0 top-0 bg-paper px-4 py-2 font-display text-[15px] tracking-[0.2em] text-brand">
                      {step.n}
                    </span>
                  </div>
                  <span aria-hidden className="draw-line mt-6 block h-px w-full bg-line" />
                  <h3 className="mt-6 font-display text-[19px] tracking-[0.08em] text-ink">{step.title}</h3>
                  <p className="mt-3.5 text-[14px] leading-[2] text-ink-soft">{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Assurance ───────────────────────────────────────────────────────── */}
        <section id="assurance" className="scroll-mt-20 border-b border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 sm:py-28 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)] lg:gap-20">
            <Reveal move="left">
              <div className="zoom-frame overflow-hidden" style={{ aspectRatio: "4 / 5" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- see the note at the top */}
                <img
                  src="/landing/assurance.jpg"
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            </Reveal>

            <div>
              <Reveal move="right">
                <p className="text-[11px] tracking-[0.4em] text-brand">TRUST</p>
                <h2 className="mt-5 font-display text-[27px] leading-[1.6] tracking-[0.1em] text-ink sm:text-[34px]">
                  AIに任せても、
                  <br className="sm:hidden" />
                  <span className="marker">医院の言葉</span>のままで。
                </h2>
                <span aria-hidden className="draw-line mt-9 block h-px w-24 bg-brand" />
              </Reveal>

              <dl className="mt-12 border-t border-line">
                {ASSURANCES.map((item, i) => (
                  <Reveal key={item.label} delay={i * 110} move="right" className="border-b border-line py-7">
                    <dt className="font-display text-[17px] tracking-[0.08em] text-ink">{item.label}</dt>
                    <dd className="mt-3 text-[14px] leading-[2] text-ink-soft">{item.body}</dd>
                  </Reveal>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ─────────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-ink">
          <div className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element -- see the note at the top */}
            <img
              src="/landing/cta.jpg"
              alt=""
              width={1536}
              height={1024}
              loading="lazy"
              decoding="async"
              className="parallax-slow h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-ink/72" />
          </div>

          <div className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
            <Reveal>
              <h2 className="font-display text-[27px] leading-[1.75] tracking-[0.1em] text-white sm:text-[34px]">
                まずは、医院の情報を
                <br className="sm:hidden" />
                入力するところから。
              </h2>
              <p className="mx-auto mt-8 max-w-lg text-[14px] leading-[2.1] text-white/75">
                途中で保存できます。ご入力いただいた内容は、担当者が確認したうえで作成にすすみます。
              </p>
            </Reveal>
            <Reveal delay={150} className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-3 rounded-full bg-paper px-9 py-4 text-[14px] font-medium text-ink transition-transform duration-300 hover:-translate-y-0.5"
              >
                無料ではじめる
                <span aria-hidden className="arrow-slide">
                  →
                </span>
              </Link>
              <Link href="/login" className="text-[14px] text-white/75 underline underline-offset-8 transition-colors hover:text-white">
                すでにアカウントをお持ちの方
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-11 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-[15px] tracking-[0.16em] text-ink">Clinc HP</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-soft">
            <Link href="/login" className="transition-colors hover:text-ink">
              ログイン
            </Link>
            <Link href="/signup" className="transition-colors hover:text-ink">
              新規登録
            </Link>
            <Link href="/admin" className="transition-colors hover:text-ink">
              管理者
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
