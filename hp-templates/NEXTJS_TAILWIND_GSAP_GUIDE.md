# クリニックサイトをNext.js＋Tailwind＋GSAPで作る方法

現在の生成パイプライン（`src/lib/siteGenerator.ts`）は、最終出力として `public/generated/<slug>/` に**素のHTML＋CSS＋JS**（`index.html`＋`css/site.css`＋`js/main.js`）を書き出す（`src/lib/render/`）。本書は、この出力の代わりに **Next.js（App Router）＋Tailwind CSS＋GSAP** で同じ内容のサイトを組み立てる具体的な方法をまとめたもの。ヒアリング〜AIコンテンツ生成の前段（`generateContentPlan` まで）はそのまま流用し、**置き換えるのは「組み立てて出力する」最後の工程だけ**。

前提知識: [`TEMPLATE_VARIABLES.md`](TEMPLATE_VARIABLES.md)（現行アーキテクチャ全体）、[`SITE_SPEC.json`](SITE_SPEC.json)（セクション仕様の正本）。

---

## 1. 方針 — データ層はそのまま、レンダリング層だけ差し替える

現在の流れ:

```
ヒアリングシート + SITE_SPEC.json + デザインプリセット
  → generateContentPlan()   … ContentPlan（JSON）
  → buildViewModel()        … SiteViewModel（JSON、表示直前の完全確定状態）
  → renderSiteHtml()        … react-dom/server で静的HTML文字列化 ← ここをNext.jsに差し替える
  → public/generated/<slug>/ に書き出し
```

`SiteViewModel`（`src/lib/render/types.ts`）は「テキスト・画像パス・表示順すべて解決済み」という設計なので、**この型のJSONさえあれば、それをどんな技術で描画するかは自由**。Next.js化にあたって触る必要があるのは以下の3点のみ：

1. `SiteViewModel` をNext.jsアプリが読める形で受け渡す（2章）
2. `src/lib/render/components.tsx` のReactコンポーネントを、素のCSSクラス依存からTailwindクラス依存に書き換える（4章）
3. `src/lib/render/main.js`（IntersectionObserver・ハンバーガーメニュー・ヘッダーのスクロール状態・FAQアコーディオン）をGSAPベースのクライアントコンポーネントに置き換える（5章）

`generateContentPlan`・`generateSiteImage`・`matchImagesToCategories`・`siteGenerator.ts` の画像生成/選定ロジックは一切変更不要。

---

## 2. データの受け渡し方

### 2-1. 推奨: `SiteViewModel` をJSONとして書き出し、Next.js側で読む

`siteGenerator.ts` の `buildViewModel()` が返す `SiteViewModel` を、現状の `renderSiteHtml(vm)` の代わりに `public/generated/<slug>/data.json` としてそのまま書き出す。

```ts
// src/lib/siteGenerator.ts の末尾（renderSiteHtml呼び出しの代わり）
await writeFile(path.join(outDir, "data.json"), JSON.stringify(vm), "utf-8");
```

Next.js側（クリニックサイト専用アプリ、または管理アプリと同居させる場合は別ルートグループ）で、動的ルートから読み込む：

```tsx
// app/sites/[slug]/page.tsx
import { readFile } from "fs/promises";
import path from "path";
import type { SiteViewModel } from "@/types/siteViewModel"; // types.tsをコピーまたはパッケージ共有
import { SitePage } from "@/components/site/SitePage";

export default async function ClinicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raw = await readFile(path.join(process.cwd(), "public", "generated", slug, "data.json"), "utf-8");
  const vm: SiteViewModel = JSON.parse(raw);
  return <SitePage vm={vm} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raw = await readFile(path.join(process.cwd(), "public", "generated", slug, "data.json"), "utf-8");
  const vm: SiteViewModel = JSON.parse(raw);
  return {
    title: vm.seo.title,
    description: vm.seo.metaDescription,
    openGraph: { title: vm.seo.ogTitle, description: vm.seo.ogDescription, siteName: vm.seo.ogSiteName, type: "website" },
  };
}
```

生成された画像（`images/*.jpg`）は `public/generated/<slug>/images/` にそのまま置かれるので、Next.js側では `/generated/<slug>/images/xxx.jpg` のURLで `next/image` から参照できる（`<Image src={...} />`、`unoptimized` か `remotePatterns` の設定は環境に応じて調整）。

### 2-2. 代替案: クリニック1件＝Next.jsアプリ1つを個別デプロイ

`public/generated/<slug>/` フォルダをそのままNext.jsプロジェクトの `data/site.json` として埋め込み、クリニックごとに個別のNext.jsプロジェクト（またはVercel/Cloudflare Pagesの個別デプロイ）を生成する方式。管理画面の「[割り当てて生成](../src/lib/contentActions.ts)」フローが今 `public/generated/<slug>/` にファイル一式を書き出しているのと同じタイミングで、Next.jsプロジェクトのひな形に `data.json` をコピーしてビルド・デプロイするジョブを追加する形になる。2-1より構築コストは高いが、サイトごとに独立したドメイン・ホスティングを持たせたい場合はこちら。

**特別な事情がなければ2-1（動的ルート1本、`slug`ごとにJSONを読むだけ）を推奨** — 現状の「1サイト＝`public/generated/<slug>/`配下に生成物一式」という構成にそのまま乗る。

---

## 3. Tailwind化 — 配色・フォント・角丸・余白のトークン化

現状の `site.css` は `:root` のCSSカスタムプロパティ（`--primary`/`--accent`/`--light`/`--radius`/`--font`/`--space-scale`）を、生成時に`<html style="--primary:...">`で1サイト分だけ確定値に上書きする方式。Tailwind v4（本プロジェクトの管理画面が使っているバージョン）でも同じ考え方がそのまま使える。

### 3-1. `SitePage` のルート要素でCSS変数を確定させる

```tsx
// components/site/SitePage.tsx
export function SitePage({ vm }: { vm: SiteViewModel }) {
  const themeStyle = {
    "--primary": vm.theme.tokens.primary,
    "--accent": vm.theme.tokens.accent,
    "--light": vm.theme.tokens.light,
    "--primary-inverse": vm.theme.tokens.primaryInverse ?? "#fff",
    "--radius": vm.cardStyle === "sharp" ? "2px" : "12px",
    "--font": vm.fontFamily === "serif" ? "var(--font-serif)" : "var(--font-sans)",
  } as React.CSSProperties;

  return (
    <div style={themeStyle} className="font-[family-name:var(--font)] text-[#2b2b2b]">
      <Header vm={vm} />
      ...
    </div>
  );
}
```

### 3-2. Tailwindのグローバルテーマにも同名トークンを登録しておく

`app/globals.css`（Tailwind v4は `tailwind.config.js` ではなくCSSの `@theme` でテーマ拡張する）：

```css
@import "tailwindcss";

@theme {
  --color-primary: var(--primary, #4ba3fc);
  --color-accent: var(--accent, #2d7dd2);
  --color-light: var(--light, #e8f4ff);
  --radius-brand: var(--radius, 12px);
  --font-sans: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif;
  --font-serif: "Hiragino Mincho ProN", "Yu Mincho", serif;
}
```

こうすると `bg-primary`・`text-accent`・`rounded-brand` のような**通常のTailwindユーティリティクラス**がそのままサイトごとの配色に追従する（`--color-primary` が実行時に `SitePage` 側の `style` で上書きされるため）。CSSカスタムプロパティ→Tailwindトークンのブリッジはこの1ファイルだけで完結する。

### 3-3. `cardStyle`/`heroLayout`/`blockLayout`/`spacing` はJSの分岐でTailwindクラスを出し分ける

これらはCSS変数1つでは表現できない「構造そのもの」の違いなので（[`AI_GUIDE.md`](AI_GUIDE.md)の一覧参照）、コンポーネント内でTailwindクラス文字列を条件分岐する。`clsx` か `cva`（class-variance-authority）を使うと見通しが良い：

```tsx
import { cva } from "class-variance-authority";

const heroLayout = cva("relative isolate overflow-hidden", {
  variants: {
    layout: {
      "full-bleed": "min-h-[70vh] grid place-items-center text-center",
      split: "grid md:grid-cols-2 items-center gap-8 py-16",
    },
  },
});

const cardsLayout = cva("mt-8", {
  variants: {
    layout: {
      grid: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
      list: "flex flex-col gap-6",
      minimal: "grid gap-6 sm:grid-cols-2",
    },
  },
});
```

`spacing: "spacious" | "compact"` は、`py-16`/`py-24` のようにセクション単位でTailwindの余白ユーティリティを出し分けるか、3-2と同様に `--space-scale` をCSS変数として渡し `py-[calc(4rem*var(--space-scale))]` のような任意値クラスで吸収する。

---

## 4. セクション⇔コンポーネントの対応表

`src/lib/render/components.tsx` の各関数を、Tailwindクラスを使ったコンポーネントに1:1で置き換える。ロジック（何を表示するか・どのフィールドを使うか）は変更不要、**クラス名だけ** `site.css` の独自クラスからTailwindユーティリティに変える。

| 現行コンポーネント | セクションID | Next.js版の置き場所 | 備考 |
|---|---|---|---|
| `Header` | `header`（structural） | `components/site/Header.tsx` | GSAPでスクロール時の影付与（5-3章） |
| `Nav` | — | `Header.tsx` に統合 or `components/site/Nav.tsx` | モバイル時はGSAPで開閉アニメーション（5-2章） |
| `Hero` | `hero`（structural） | `components/site/Hero.tsx` | `heroLayout` で`full-bleed`/`split`を出し分け |
| `AiSection` | `department`/`greeting`/`features`/`facility` | `components/site/AiSection.tsx` | `blockLayout`で`grid`/`list`/`minimal`を出し分け（4-1節） |
| `HoursSection` | `hours` | `components/site/HoursSection.tsx` | AI非関与、`hearing.hours`をそのまま表示 |
| `AccessSection` | `access` | `components/site/AccessSection.tsx` | Google Maps iframe埋め込みはそのまま |
| `NewsSection` | `news` | `components/site/NewsSection.tsx` | — |
| `StaffSection` | `staff` | `components/site/StaffSection.tsx` | — |
| `FaqSection` | `faq` | `components/site/FaqAccordion.tsx`（クライアント） | 開閉はGSAP（5-4章） |
| `PricingSection` | `pricing` | `components/site/PricingSection.tsx` | — |
| `ContactSection` | `contact` | `components/site/ContactSection.tsx` | — |
| `Footer` | `footer`（structural） | `components/site/Footer.tsx` | — |

`SitePage`（現 `components.tsx` 内）は `app/sites/[slug]/page.tsx` 自体、または `components/site/SitePage.tsx`（Server Component）としてそのまま移植する。`vm.navItems` を順に回して `AiSection` か固定セクションかを振り分けるロジック（`FIXED_SECTION_IDS`）は変更不要。

### 4-1. `AiSection` のTailwind版（`blockLayout`分岐の例）

```tsx
// components/site/AiSection.tsx
import { cardsLayout } from "./variants"; // 3-3のcva定義

export function AiSection({ section, blockLayout }: { section: SectionView; blockLayout: SiteViewModel["blockLayout"] }) {
  const hasBlockImages = blockLayout !== "minimal" && section.blocks.some((b) => b.image);
  return (
    <section id={section.id} className="scroll-mt-20 py-16 sm:py-24">
      <RevealOnScroll className="mx-auto max-w-5xl px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{section.label}</h2>
        {section.image ? (
          <div className="mt-6 grid gap-8 md:grid-cols-2 md:items-center">
            <img src={section.image} alt="" className="rounded-brand w-full object-cover" />
            <p className="text-lg leading-relaxed">{section.body}</p>
          </div>
        ) : (
          section.body && <p className="mt-4 text-lg leading-relaxed">{section.body}</p>
        )}
        {section.blocks.length > 0 && (
          <div className={cardsLayout({ layout: blockLayout })}>
            {section.blocks.map((block, i) => (
              <div key={i} className="rounded-brand border border-black/5 bg-white p-6 shadow-sm">
                {blockLayout === "minimal" ? (
                  <span aria-hidden className="text-primary text-sm font-bold">{String(i + 1).padStart(2, "0")}</span>
                ) : (
                  hasBlockImages && block.image && (
                    <img src={block.image} alt="" className="rounded-brand mb-4 aspect-[4/3] w-full object-cover" />
                  )
                )}
                <h3 className="font-bold">{block.heading}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/70">{block.body}</p>
              </div>
            ))}
          </div>
        )}
      </RevealOnScroll>
    </section>
  );
}
```

`RevealOnScroll` は現行 `.reveal`/`IntersectionObserver`（`main.js`）の置き換え。5-1章で定義する。

---

## 5. GSAP化 — `main.js` の4機能をそれぞれ置き換える

`npm install gsap @gsap/react` を追加する（クライアントコンポーネント側のみで使用、Server Componentからは呼ばない）。

| `main.js` の関数 | 役割 | GSAP版の置き場所 |
|---|---|---|
| `setupScrollReveal` | スクロールで要素をフェードイン | `components/site/RevealOnScroll.tsx`（5-1） |
| `setupMobileNavAutoClose` / ハンバーガー開閉 | モバイルメニューの開閉 | `components/site/MobileNav.tsx`（5-2） |
| `setupHeaderScrollState` | スクロールでヘッダーに影を付ける | `components/site/Header.tsx`（5-3） |
| `setupFaqAccordion` | FAQの開閉 | `components/site/FaqAccordion.tsx`（5-4） |

すべて `"use client"` コンポーネント。`SitePage`／各セクションはServer Componentのままにして、アニメーションが要る葉ノードだけをクライアントコンポーネントとして切り出す（Server/Client境界を最小化する定石）。

### 5-1. スクロールリビール（`.reveal` の置き換え）

```tsx
// components/site/RevealOnScroll.tsx
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function RevealOnScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    gsap.set(ref.current, { opacity: 0, y: 28 });
    gsap.to(ref.current, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: { trigger: ref.current, start: "top 88%", once: true },
    });
  }, { scope: ref });

  return <div ref={ref} className={className}>{children}</div>;
}
```

`main.js` の `IntersectionObserver`（`threshold: 0.12, rootMargin: "0px 0px -40px 0px"`）とほぼ同等の発火タイミングを `ScrollTrigger` の `start: "top 88%"` で再現している。`once: true` が旧実装の `observer.unobserve()`（1回きり）に対応。

### 5-2. モバイルナビ（ハンバーガーメニュー）

現行は `<input type="checkbox">` によるCSSのみの開閉（`.nav-toggle`）。GSAP版はReactの状態で開閉し、開閉アニメーションをGSAPタイムラインで作る：

```tsx
// components/site/MobileNav.tsx
"use client";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { NavItem } from "@/types/siteViewModel";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline>(null);

  useGSAP(() => {
    if (!panelRef.current) return;
    tl.current = gsap
      .timeline({ paused: true })
      .set(panelRef.current, { display: "flex" })
      .from(panelRef.current, { height: 0, duration: 0.35, ease: "power2.inOut" })
      .from(panelRef.current.querySelectorAll("a"), { opacity: 0, y: -8, stagger: 0.04, duration: 0.25 }, "-=0.15");
  }, { scope: panelRef });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) tl.current?.play(0);
      else tl.current?.reverse();
      return next;
    });
  }

  return (
    <>
      <button onClick={toggle} aria-label="メニュー" aria-expanded={open} className="md:hidden">
        {/* ハンバーガーアイコン。openに応じてclassNameでバー3本をX字に回転させてもよい */}
      </button>
      <div ref={panelRef} className="fixed inset-x-0 top-16 hidden flex-col overflow-hidden bg-primary text-white md:hidden">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={toggle} className="px-6 py-3">
            {item.label}
          </a>
        ))}
      </div>
    </>
  );
}
```

`main.js` の `setupMobileNavAutoClose`（メニュー項目をクリックしたら自動で閉じる）は、上記の `onClick={toggle}` にそのまま相当する。

### 5-3. ヘッダーのスクロール状態（影付与）

```tsx
// components/site/Header.tsx（抜粋、"use client"）
useGSAP(() => {
  if (!headerRef.current) return;
  ScrollTrigger.create({
    start: "top -10",
    onUpdate: (self) => headerRef.current?.classList.toggle("shadow-md", self.scroll() > 10),
  });
}, { scope: headerRef });
```

`main.js` の `header.classList.toggle("is-scrolled", window.scrollY > 10)` を、`window.addEventListener("scroll")` の手書きの代わりに `ScrollTrigger` で管理する形。`sticky top-0 z-30` はそのままTailwindのユーティリティで表現できるのでGSAP不要。

### 5-4. FAQアコーディオン

```tsx
// components/site/FaqAccordion.tsx
"use client";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { FaqItem } from "@/types/siteViewModel";

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!bodyRef.current) return;
    gsap.to(bodyRef.current, {
      height: open ? "auto" : 0,
      opacity: open ? 1 : 0,
      duration: 0.3,
      ease: "power1.inOut",
    });
  }, [open]);

  return (
    <div className="border-b border-black/10 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left font-medium"
      >
        <span>{item.question}</span>
        <span aria-hidden className={`transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div ref={bodyRef} className="overflow-hidden text-sm text-black/70">
        <p className="pt-3">{item.answer}</p>
      </div>
    </div>
  );
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return <div>{items.map((item, i) => <FaqRow key={i} item={item} />)}</div>;
}
```

`gsap.to(el, { height: "auto" })` はGSAP 3.13+で高さ`auto`への直接アニメーションに対応済み（それ以前のバージョンでは `scrollHeight` を都度測って数値を渡す必要がある。`package.json` に追加する `gsap` は最新版を使うこと）。

---

## 6. `prefers-reduced-motion` 対応

現行CSSは `@media (prefers-reduced-motion: reduce)` でアニメーション時間を実質0にしている。GSAP版でも同様に、`gsap.matchMedia()` でラップするか、初期化前に判定してアニメーションをスキップする：

```ts
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (prefersReducedMotion) {
  gsap.set(ref.current, { opacity: 1, y: 0 }); // アニメーションせず最終状態を即座に適用
} else {
  gsap.to(ref.current, { ... });
}
```

---

## 7. 導入手順まとめ

1. `npm install gsap @gsap/react class-variance-authority`（Tailwindは本プロジェクトの管理アプリと同様に導入済み前提。バージョンは `package.json` のTailwind v4系に合わせる）
2. `src/lib/render/types.ts` の型（`SiteViewModel` ほか）をNext.jsプロジェクト側にコピーするか、共有パッケージ化する
3. `siteGenerator.ts` の出力を `renderSiteHtml()`（HTML文字列化）から `data.json` 書き出し（2-1章）に差し替える
4. `src/lib/render/components.tsx` の各コンポーネントを、4章の対応表に沿ってTailwind版として `components/site/` 配下に作る
5. `src/lib/render/main.js` の4機能を、5章の対応表に沿ってGSAPクライアントコンポーネントとして作る
6. `app/sites/[slug]/page.tsx`（Server Component）で `data.json` を読み込み、`SitePage` を描画。`generateMetadata` でSEOを設定
7. `app/globals.css` に3-2章の `@theme` トークンを追加

`generateContentPlan`・`generateSiteImage`・`matchImagesToCategories` を含む「AIが何を生成するか」の仕様（[`SITE_SPEC.json`](SITE_SPEC.json)）は一切変更不要。**変わるのは最終出力の技術スタックだけ**、というのがこの移行の要点。
