"use client";

import { contrastRatio, readableOn } from "@/lib/site/color";
import type { DesignTokens } from "@/lib/site/document";
import { ColorField, NumberField, SelectField, TextField, ToggleField } from "./fields";

/** Everything the template decides about how the page looks. These are the same tokens the URL
 * importer produces, so a design imported from a reference site and one dialled in by hand are
 * indistinguishable downstream. */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-[13px] font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

export function DesignPanel({
  design,
  onChange,
}: {
  design: DesignTokens;
  onChange: (next: DesignTokens) => void;
}) {
  function set<K extends keyof DesignTokens>(key: K, value: Partial<DesignTokens[K]>) {
    onChange({ ...design, [key]: { ...design[key], ...value } });
  }

  // The renderer derives readable text variants of primary/accent automatically, so a low-contrast
  // brand colour is never illegible on the page. Showing the ratio here explains why the preview's
  // heading colour may not match the swatch, instead of looking like a bug.
  const accentRatio = contrastRatio(design.colors.accent, design.colors.background);
  const accentText = readableOn(design.colors.accent, design.colors.background, design.colors.text);

  return (
    <div className="flex flex-col gap-4">
      <Group title="配色">
        <ColorField label="メインカラー" value={design.colors.primary} onChange={(primary) => set("colors", { primary })} />
        <ColorField
          label="アクセントカラー"
          value={design.colors.accent}
          onChange={(accent) => set("colors", { accent })}
        />
        <ColorField
          label="淡い背景色"
          value={design.colors.light}
          hint="セクションを交互に塗り分けるときの薄い色です。"
          onChange={(light) => set("colors", { light })}
        />
        <ColorField
          label="ページの背景色"
          value={design.colors.background}
          onChange={(background) => set("colors", { background })}
        />
        <ColorField label="本文の文字色" value={design.colors.text} onChange={(text) => set("colors", { text })} />
        <ColorField
          label="メインカラーの上に乗る文字色"
          value={design.colors.primaryInverse}
          hint="ボタンやメニューの文字色です。"
          onChange={(primaryInverse) => set("colors", { primaryInverse })}
        />
        <ColorField
          label="アクセントカラーの上に乗る文字色"
          value={design.colors.accentInverse}
          onChange={(accentInverse) => set("colors", { accentInverse })}
        />

        {accentRatio < 4.5 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
            アクセントカラーは背景に対してコントラスト比 {accentRatio.toFixed(1)}:1 で、文字色としては読みにくい値です
            （4.5:1以上が目安）。見出しなどの文字には自動で
            <span className="mx-1 rounded px-1 font-mono" style={{ background: accentText, color: design.colors.background }}>
              {accentText}
            </span>
            を使います。塗り（メニューの背景など）には指定どおりの色を使います。
          </p>
        )}
      </Group>

      <Group title="文字">
        <TextField
          label="見出しのフォント"
          value={design.font.headingFamily}
          hint="CSSの font-family に書ける形式で。末尾は sans-serif か serif で終わらせてください。"
          onChange={(headingFamily) => set("font", { headingFamily })}
        />
        <TextField
          label="本文のフォント"
          value={design.font.bodyFamily}
          onChange={(bodyFamily) => set("font", { bodyFamily })}
        />
        <TextField
          label="Google Fonts"
          value={design.font.googleFonts.join(", ")}
          placeholder="Noto Sans JP:wght@400;700"
          hint="カンマ区切り。空欄なら端末のフォントだけを使い、外部への通信は発生しません。"
          onChange={(raw) =>
            set("font", {
              googleFonts: raw
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean),
            })
          }
        />
        <NumberField
          label="本文の文字サイズ"
          value={design.font.baseSize}
          min={12}
          max={22}
          unit="px"
          onChange={(baseSize) => set("font", { baseSize })}
        />
        <NumberField
          label="行間"
          value={design.font.lineHeight}
          min={1.2}
          max={2.4}
          step={0.05}
          onChange={(lineHeight) => set("font", { lineHeight })}
        />
        <NumberField
          label="見出しの太さ"
          value={design.font.headingWeight}
          min={300}
          max={900}
          step={100}
          onChange={(headingWeight) => set("font", { headingWeight })}
        />
        <NumberField
          label="見出しの大きさ"
          value={design.font.displayScale}
          min={1}
          max={2.2}
          step={0.05}
          unit="倍"
          hint="本文はそのままで、見出しだけを大きくします。写真が少ないデザインでは、ここを上げると印象が決まります。"
          onChange={(displayScale) => set("font", { displayScale })}
        />
        <NumberField
          label="見出しの字間"
          value={design.font.headingLetterSpacing}
          min={-0.02}
          max={0.3}
          step={0.01}
          unit="em"
          hint="広げるほど落ち着いた印象になります。明朝体と組み合わせると効果的です。"
          onChange={(headingLetterSpacing) => set("font", { headingLetterSpacing })}
        />
      </Group>

      <Group title="ブロックの形">
        <NumberField
          label="角丸"
          value={design.block.radius}
          min={0}
          max={48}
          unit="px"
          hint="0にすると角ばった、硬派な印象になります。"
          onChange={(radius) => set("block", { radius })}
        />
        <NumberField
          label="枠線の太さ"
          value={design.block.borderWidth}
          min={0}
          max={4}
          unit="px"
          onChange={(borderWidth) => set("block", { borderWidth })}
        />
        <ColorField
          label="枠線の色"
          value={design.block.borderColor}
          onChange={(borderColor) => set("block", { borderColor })}
        />
        <SelectField
          label="影"
          value={design.block.shadow}
          options={[
            { value: "none", label: "なし（フラット）" },
            { value: "soft", label: "やわらかい" },
            { value: "strong", label: "強い（浮き上がる）" },
          ]}
          onChange={(shadow) => set("block", { shadow: shadow as DesignTokens["block"]["shadow"] })}
        />
        <SelectField
          label="カードの並べ方"
          value={design.block.cardLayout}
          hint="ページ全体の印象が最も大きく変わる設定です。"
          options={[
            { value: "grid", label: "グリッド（写真つきカードを並べる）" },
            { value: "list", label: "リスト（写真＋文章を横並びで積む）" },
            { value: "minimal", label: "ミニマル（写真なし・番号つき）" },
            { value: "overlap", label: "オーバーラップ（少しずらして重ねる）" },
          ]}
          onChange={(cardLayout) => set("block", { cardLayout: cardLayout as DesignTokens["block"]["cardLayout"] })}
        />
      </Group>

      <Group title="レイアウト">
        <SelectField
          label="メインビジュアルの形"
          value={design.layout.heroLayout}
          options={[
            { value: "full-bleed", label: "全面（写真の上に文字を重ねる）" },
            { value: "split", label: "左右分割（写真と文字を並べる）" },
            { value: "centered", label: "中央（写真の下に文字を置く）" },
          ]}
          onChange={(heroLayout) => set("layout", { heroLayout: heroLayout as DesignTokens["layout"]["heroLayout"] })}
        />
        <NumberField
          label="コンテンツの最大幅"
          value={design.layout.maxWidth}
          min={880}
          max={1440}
          step={20}
          unit="px"
          onChange={(maxWidth) => set("layout", { maxWidth })}
        />
        <NumberField
          label="余白の広さ"
          value={design.layout.spacingScale}
          min={0.7}
          max={2}
          step={0.05}
          unit="倍"
          hint="大きいほどゆったりして高級感が出ます。"
          onChange={(spacingScale) => set("layout", { spacingScale })}
        />
        <SelectField
          label="セクションの区切り"
          value={design.layout.sectionDivider}
          options={[
            { value: "none", label: "なし（まっすぐ）" },
            { value: "wave", label: "波線" },
            { value: "diagonal", label: "斜め" },
          ]}
          onChange={(sectionDivider) =>
            set("layout", { sectionDivider: sectionDivider as DesignTokens["layout"]["sectionDivider"] })
          }
        />
        <SelectField
          label="ページの背景"
          value={design.layout.background}
          options={[
            { value: "plain", label: "無地（白と淡色の交互）" },
            { value: "gradient", label: "グラデーション" },
            { value: "blobs", label: "ぼかした色の塊" },
            { value: "dots", label: "ドット柄" },
            { value: "grid", label: "方眼柄" },
          ]}
          hint="無地のままだと、白い箱が縦に積み上がった単調な見た目になりがちです。"
          onChange={(background) =>
            set("layout", { background: background as DesignTokens["layout"]["background"] })
          }
        />
        <SelectField
          label="見出しの区切り方"
          value={design.layout.rule}
          options={[
            { value: "none", label: "太い下線（標準）" },
            { value: "hairline", label: "細い罫線（セクションの境目に引く）" },
            { value: "accent-bar", label: "左に色の帯" },
          ]}
          hint="写真を減らしたデザインでは、太い下線が画面でいちばん強い要素になり、事務的に見えます。"
          onChange={(rule) => set("layout", { rule: rule as DesignTokens["layout"]["rule"] })}
        />
        <SelectField
          label="セクションの地紋（模様）"
          value={design.layout.ornament}
          options={[
            { value: "none", label: "なし" },
            { value: "seigaiha", label: "青海波（波の弧）" },
            { value: "asanoha", label: "麻の葉（三角格子）" },
            { value: "dots-fine", label: "細かいドット" },
            { value: "hairlines", label: "斜めの細い線" },
            { value: "arc", label: "大きな弧（右上から）" },
          ]}
          hint="画像ファイルは使いません。CSSで描くので読み込みが増えず、色はテーマカラーに追従します。"
          onChange={(ornament) => set("layout", { ornament: ornament as DesignTokens["layout"]["ornament"] })}
        />
        <NumberField
          label="地紋の濃さ"
          value={design.layout.ornamentStrength}
          min={0}
          max={1}
          step={0.02}
          unit=""
          hint="0で見えなくなります。0.1〜0.2 が自然です。0.3を超えると柄が本文より目立ちます。"
          onChange={(ornamentStrength) => set("layout", { ornamentStrength })}
        />
        <SelectField
          label="背景写真"
          value={design.layout.backdrop}
          options={[
            { value: "none", label: "なし" },
            { value: "page", label: "ページ全体の背景に敷く" },
            { value: "sections", label: "淡色セクションの背景に敷く" },
          ]}
          hint="写真はサイト生成時にAIが作ります。文字が読めるよう、必ず背景色の膜を重ねます。まだ写真が無い間は何も表示されません。"
          onChange={(backdrop) => set("layout", { backdrop: backdrop as DesignTokens["layout"]["backdrop"] })}
        />
        <SelectField
          label="装飾の量"
          value={design.layout.decoration}
          options={[
            { value: "none", label: "なし" },
            { value: "accent", label: "控えめ（見出しの下線を強調）" },
            { value: "rich", label: "多め（セクション番号・角の飾り）" },
          ]}
          onChange={(decoration) =>
            set("layout", { decoration: decoration as DesignTokens["layout"]["decoration"] })
          }
        />
      </Group>

      <Group title="動き">
        <SelectField
          label="スクロールで現れる演出"
          value={design.animation.reveal}
          options={[
            { value: "none", label: "なし" },
            { value: "fade", label: "ふわっと表示" },
            { value: "slide-up", label: "下から上へ" },
            { value: "slide-left", label: "左から流れ込む" },
            { value: "slide-right", label: "右から流れ込む" },
            { value: "zoom", label: "少し拡大しながら" },
            { value: "pop", label: "ぽんと弾んで出る" },
            { value: "flip", label: "奥から起き上がる" },
            { value: "blur", label: "ぼけから像を結ぶ" },
          ]}
          onChange={(reveal) => set("animation", { reveal: reveal as DesignTokens["animation"]["reveal"] })}
        />
        <NumberField
          label="演出の速さ"
          value={design.animation.duration}
          min={0}
          max={2000}
          step={50}
          unit="ms"
          onChange={(duration) => set("animation", { duration })}
        />
        <ToggleField
          label="カードを1枚ずつ順番に表示する"
          value={design.animation.stagger}
          onChange={(stagger) => set("animation", { stagger })}
        />
        <ToggleField
          label="セクションごとに演出を変える"
          value={design.animation.variety}
          hint="登場の向きとカードの並びが4セクション周期で入れ替わり、同じ動きの繰り返しになりません。"
          onChange={(variety) => set("animation", { variety })}
        />
        <SelectField
          label="地紋を動かし続ける"
          value={design.animation.ambient}
          options={[
            { value: "none", label: "動かさない" },
            { value: "drift", label: "ゆっくり流れる" },
            { value: "float", label: "ふわふわ上下する" },
            { value: "sheen", label: "光が横切る" },
          ]}
          hint="地紋（模様）だけが動きます。文字や写真は動かないので、読みやすさは変わりません。地紋が「なし」のときは何も起きません。"
          onChange={(ambient) => set("animation", { ambient: ambient as DesignTokens["animation"]["ambient"] })}
        />
        <ToggleField
          label="読み進み具合のバーを出す"
          value={design.animation.progressBar}
          hint="画面のいちばん上に細い線が出て、ページのどのあたりを読んでいるかを示します。"
          onChange={(progressBar) => set("animation", { progressBar })}
        />
        <ToggleField
          label="メインビジュアルをゆっくり動かす（パララックス）"
          value={design.animation.parallaxHero}
          hint="「全面」のメインビジュアルにのみ効きます。"
          onChange={(parallaxHero) => set("animation", { parallaxHero })}
        />
        <p className="text-[12px] leading-relaxed text-slate-400">
          端末側で「視差効果を減らす」設定がされている場合、これらの演出は自動的に無効になります。
        </p>
      </Group>
    </div>
  );
}
