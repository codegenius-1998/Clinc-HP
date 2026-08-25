import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listTemplates } from "@/lib/site/store";
import { siteOutputPath } from "@/lib/render/renderSiteFiles";
import { Reveal } from "@/components/ui/Reveal";

/** The public landing page — the product's own face, and the only screen here a clinic sees before
 * deciding to sign up. It used to be the login form, which told a first-time visitor nothing.
 *
 * Reading the session serves two purposes: someone already signed in gets sent to their own pages
 * rather than being asked to sign in again, and touching cookies keeps this route dynamic. The
 * second matters more than it looks — a statically prerendered version would try to reach D1 during
 * `next build`, on a machine that may have no credentials, and bake in whatever it found.
 *
 * ⚠️ The showcase below deliberately lists TEMPLATES, never generated clinic sites. Those belong to
 * real clinics, and putting one on a sales page is a permission question, not a design decision. */

const STEPS = [
  {
    n: "01",
    title: "10の質問に答える",
    body: "医院名・診療時間・スタッフ・料金など、お手元の情報を順に入力します。写真をお持ちなら一緒にお預かりします。",
  },
  {
    n: "02",
    title: "AIがページを作る",
    body: "文章も、院内やスタッフの写真も、いただいた内容だけを根拠にAIが用意します。電話番号や料金を創作することはありません。",
  },
  {
    n: "03",
    title: "手直しして公開",
    body: "できあがったページを画面上で直接編集できます。文字をクリックして書き換え、そのまま公開できます。",
  },
];

const FEATURES = [
  {
    title: "書かなくていい",
    body: "キャッチコピーも、診療案内の説明文も、ご挨拶も。入力いただいた事実をもとにAIが下書きします。文章が苦手でも、埋めるのは事実だけです。",
  },
  {
    title: "写真がなくてもいい",
    body: "院内の写真をお持ちでなくても構いません。文字と余白で成立するデザインをご用意しています。お持ちの写真があれば、それを優先して使います。",
  },
  {
    title: "医療広告ガイドラインを確認",
    body: "「地域No.1」「必ず治る」といった、医療広告として問題になりうる表現がないか、公開前にAIが読んで指摘します。",
  },
  {
    title: "表示崩れを機械が検査",
    body: "スマートフォンで横にはみ出していないか、画像が抜けていないか、文字が読める色かを、実際にブラウザで開いて測ります。",
  },
];

export default async function LandingPage() {
  const session = await getSession();

  // The landing page must render even when D1 is unreachable — a database blip is not a reason to
  // show a broken sales page. Falling back to an empty list simply hides the showcase section.
  const templates = await listTemplates({ sellableOnly: true }).catch(() => []);

  const signedInHref = session?.role === "admin" ? "/admin/dashboard" : session ? "/home" : null;

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-display text-[17px] tracking-[0.14em] text-ink">Clinc HP</span>
          <nav className="flex items-center gap-3 text-[13px]">
            {signedInHref ? (
              <Link
                href={signedInHref}
                className="rounded-full bg-brand px-5 py-2.5 font-medium text-paper transition-colors hover:bg-brand-deep"
              >
                管理画面へ
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-2 py-2 text-ink-soft transition-colors hover:text-ink">
                  ログイン
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-brand px-5 py-2.5 font-medium text-paper transition-colors hover:bg-brand-deep"
                >
                  はじめる
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero. No stock photograph on purpose: this page is selling design judgement, and a generic
            smiling-doctor image is the exact thing the product exists to avoid. */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
            <Reveal>
              <p className="text-[11px] tracking-[0.4em] text-brand">CLINIC HOMEPAGE STUDIO</p>
              <h1 className="mt-8 font-display text-[34px] leading-[1.5] tracking-[0.06em] text-ink sm:text-[52px] sm:leading-[1.45]">
                クリニックの
                <br />
                ホームページを、
                <br />
                <span className="text-brand">10の質問</span>から。
              </h1>
              <p className="mt-10 max-w-xl border-l border-line pl-5 text-[15px] leading-[2.1] text-ink-soft">
                医院名、診療時間、スタッフ、料金。お手元にある情報を順に入力するだけで、文章も写真もそろった一式のホームページができあがります。
                できたページは、その場で書き換えて公開できます。
              </p>
            </Reveal>

            <Reveal delay={120} className="mt-12 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-3 rounded-full bg-brand px-8 py-4 text-[14px] font-medium text-paper transition-transform hover:-translate-y-0.5 hover:bg-brand-deep"
              >
                無料ではじめる
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/login"
                className="text-[14px] text-ink-soft underline underline-offset-8 transition-colors hover:text-ink"
              >
                すでにアカウントをお持ちの方
              </Link>
            </Reveal>

            <Reveal delay={200} className="mt-20 grid gap-px overflow-hidden border-y border-line sm:grid-cols-3">
              {[
                ["入力は10ステップ", "医院の基本情報から料金表まで"],
                ["作成はおよそ4分", "文章と画像をまとめて用意します"],
                ["公開前に2つの検査", "医療広告表現と、表示の崩れ"],
              ].map(([title, body]) => (
                <div key={title} className="bg-paper py-7 sm:px-6">
                  <p className="font-display text-[17px] tracking-[0.08em] text-ink">{title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="border-b border-line bg-canvas">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <Reveal>
              <h2 className="font-display text-[26px] tracking-[0.12em] text-ink sm:text-[30px]">制作の流れ</h2>
            </Reveal>
            <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 100}>
                  <p className="font-display text-[38px] leading-none tracking-[0.08em] text-brand/45">{step.n}</p>
                  <h3 className="mt-5 font-display text-[19px] tracking-[0.08em] text-ink">{step.title}</h3>
                  <p className="mt-3 text-[14px] leading-[2] text-ink-soft">{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <Reveal>
              <h2 className="font-display text-[26px] tracking-[0.12em] text-ink sm:text-[30px]">できること</h2>
            </Reveal>
            <div className="mt-12 grid gap-px border-t border-line sm:grid-cols-2">
              {FEATURES.map((feature, i) => (
                <Reveal key={feature.title} delay={(i % 2) * 100} className="border-b border-line bg-paper py-9 sm:px-8">
                  <h3 className="font-display text-[18px] tracking-[0.08em] text-ink">{feature.title}</h3>
                  <p className="mt-3 max-w-md text-[14px] leading-[2] text-ink-soft">{feature.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {templates.length > 0 && (
          <section className="border-b border-line bg-canvas">
            <div className="mx-auto max-w-5xl px-6 py-24">
              <Reveal>
                <h2 className="font-display text-[26px] tracking-[0.12em] text-ink sm:text-[30px]">デザインの型</h2>
                <p className="mt-5 max-w-xl text-[14px] leading-[2] text-ink-soft">
                  ご入力いただいた診療科や医院の雰囲気に合わせて、AIがこの中から選びます。同じ型でも、セクションの見せ方と配色は医院ごとに変わります。
                </p>
              </Reveal>
              <div className="mt-12 grid gap-5 sm:grid-cols-2">
                {templates.map((template, i) => (
                  <Reveal key={template.id} delay={(i % 2) * 100}>
                    <a
                      href={siteOutputPath(template).previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-full flex-col border border-line bg-paper p-7 transition-colors hover:border-brand"
                    >
                      <h3 className="font-display text-[18px] tracking-[0.08em] text-ink">{template.name}</h3>
                      {template.mood && (
                        <p className="mt-3 line-clamp-3 text-[13px] leading-[1.9] text-ink-soft">{template.mood}</p>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                        {template.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="bg-brand-soft px-2.5 py-1 text-[11px] tracking-wide text-brand">
                            {tag}
                          </span>
                        ))}
                        <span className="ml-auto text-[12px] text-brand">見本を開く →</span>
                      </div>
                    </a>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="mx-auto max-w-5xl px-6 py-28 text-center">
            <Reveal>
              <h2 className="font-display text-[26px] leading-[1.7] tracking-[0.1em] text-ink sm:text-[32px]">
                まずは、医院の情報を
                <br className="sm:hidden" />
                入力するところから。
              </h2>
              <p className="mx-auto mt-7 max-w-md text-[14px] leading-[2] text-ink-soft">
                途中で保存できます。入力いただいた内容は、担当者が確認したうえで作成にすすみます。
              </p>
              <Link
                href="/signup"
                className="mt-12 inline-flex items-center gap-3 rounded-full bg-brand px-9 py-4 text-[14px] font-medium text-paper transition-transform hover:-translate-y-0.5 hover:bg-brand-deep"
              >
                無料ではじめる
                <span aria-hidden>→</span>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-[15px] tracking-[0.14em] text-ink">Clinc HP</span>
          <div className="flex items-center gap-6 text-[13px] text-ink-soft">
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
