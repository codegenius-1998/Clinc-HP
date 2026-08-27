---
name: template-from-url
description: 参考サイトのURLから、このアプリのテンプレート（src/lib/site/templates/*.json）を1つ作る。色・書体・ボタンの大きさ・余白・装飾・動き・セクション構成を実際のブラウザで実測し、frontend-design で作り直して、LP1枚にまとめる。「このサイトみたいなテンプレートを作って」と URL を渡されたときに使う。
---

# URLからテンプレートを作る

```
/template-from-url https://example.com
```

**成果物は3つだけ。** どれもリポジトリの中のファイルで、AIの実行時判断は一切残らない。

| ファイル | 要否 |
|---|---|
| `src/lib/site/templates/<key>.json` | 必ず |
| `src/lib/site/templates/index.ts` に import 1行 | 必ず（**忘れると本番でだけ消える**） |
| `src/lib/render/kits/<key>.ts` ＋ `kits/index.ts` に1行 | そのテンプレート専用のCSS/JSを書くときだけ |

⚠️ **アプリの中の「URL取り込み」（`src/lib/template/importFromUrl.ts`）とは別物。** あちらは管理画面から誰でも押せる本番機能で、HTMLとCSSを*文字列として*読む。こちらはブラウザで**実際に描かれたページを測って**手でJSONを書く手順で、精度も自由度も比べものにならない代わりに、私が1回ずつ走らせないと動かない。どちらかがもう一方を置き換えることはない。

⚠️ 先に [CLAUDE.md](../../../CLAUDE.md) と [AGENTS.md](../../../AGENTS.md) を読むこと。特に **`.default()` の規則**（新しいフィールドに既定値が無いと、既存サイトのデザインが全部消える）と **ブロックIDが生成画像のファイル名を兼ねる**こと。

---

## 1. 何を写し、何を写さないか

**この章がこの手順書の芯。** 迷ったらここに戻る。

参考サイトは **「写す対象」ではなく「方向性の指定」**。読み手が受け取る *印象* を再現し、その印象を作るための具体的な値は自分で決め直す。

| 測って**必ず**合わせる（＝印象） | 自分で**決め直す**（＝具体値） |
|---|---|
| 明るい／暗い、彩度が高い／低い | 具体的な hex |
| 書体の分類（明朝・ゴシック・丸ゴシック）と太さ | 具体的な書体名 |
| 見出しと本文の**大きさの比**、字間の広さ | 具体的な px |
| 余白が詰まっている／ゆったり | 具体的な数値 |
| 角の丸さ・影の強さの**度合い** | 具体的な数値 |
| 写真の量、1画面あたりの情報量 | 写真の中身 |
| 動きの多さ・速さ | 動きのかたち |
| セクションの**役割の並び**（何を先に見せる医院か） | 並びの丸写し・見出しの言葉 |

⚠️ **これは同時に著作権の壁でもある。** 参考サイトの言葉・画像・ロゴ・具体的な配色・書体名は、テンプレートに一切入れない。入るのは比率と印象だけ。

### frontend-design との関係

`frontend-design` スキルは「テンプレートっぽくするな・その案件のための選択をしろ・ひとつ冒険しろ」と言う。素朴な模写と正面から衝突するので、**優先順位を先に決めてある — `frontend-design` が勝つ。**

- **右の列（具体値）は `frontend-design` が決める。** 参考サイトが `#2b6cb0` でも、その青をそのまま使わない。「落ち着いた中明度の寒色」という*観測*だけを引き継ぎ、配色はこのテンプレートのために組む
- **左の列（印象）は参考サイトが決める。** ここで `frontend-design` の「冒険」を発動させない。余白が詰まったサイトをゆったりに作り直したら、それは別のサイト
- **冒険の予算は1か所。** `frontend-design` が言う「signature」— 記憶に残る一点 — に使う。それ以外は静かに、規律よく

---

## 2. 観察する

### 2-1. 目で見る

```
preview_start { url: "https://example.com" }
```

そのあと **1280px と 390px の両方**でスクリーンショット（`resize_window` の `desktop` / `mobile`）。⚠️ スマートフォンの見え方を見ないと、そのサイトが本当は何を大事にしているかが分からない。個人クリニックのサイトは訪問者の7割以上がスマートフォンで、多くのサイトはそちらを主に設計している。

⚠️ **スクリーンショットはスクロールに追随しないことがある**（撮影面が先頭のまま固まり、真っ白な画像が返る）。時間を溶かすので、粘らずに次の2つへ切り替えること：

- `resize_window` で **`mobile` プリセットにすると実寸のビューポートが立ち**、撮影が安定する。ページ下部を見たいときは、上のセクションを `style.display='none'` で一時的に消してから先頭を撮る
- スクロール連動で要素が消えているだけのことも多い。`document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'))`（自作サイト側）や、`opacity`/`transform` を打ち消してから撮る

**構造と数値の確認は `javascript_tool` のほうが速くて確実。** 見た目の最終確認だけスクリーンショットに任せる。

### 2-2. 文章の骨格を取る

```
get_page_text
```

⚠️ **読むのは「どんな役割のかたまりが、どの順で並んでいるか」だけ。** 文章そのものは持ち帰らない（1章）。

### 2-3. 測る

`javascript_tool` に、これをそのまま渡す。

```js
(() => {
  const round = (v) => Math.round(parseFloat(v) * 100) / 100;
  const bgArea = new Map();
  const textColor = new Map();
  const radius = new Map();
  const shadow = new Map();
  let imageArea = 0;
  let animated = 0;
  let transitioned = 0;

  const els = Array.from(document.querySelectorAll("body *"));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    const area = r.width * r.height;
    if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
      bgArea.set(cs.backgroundColor, (bgArea.get(cs.backgroundColor) || 0) + area);
    }
    if (!el.childElementCount && el.textContent.trim()) {
      textColor.set(cs.color, (textColor.get(cs.color) || 0) + 1);
    }
    if (el.tagName === "IMG" || cs.backgroundImage.includes("url(")) imageArea += area;
    const rad = round(cs.borderTopLeftRadius);
    if (rad > 0) radius.set(rad, (radius.get(rad) || 0) + 1);
    if (cs.boxShadow !== "none") shadow.set(cs.boxShadow, (shadow.get(cs.boxShadow) || 0) + 1);
    if (cs.animationName !== "none") animated++;
    if (cs.transitionDuration !== "0s") transitioned++;
  }

  const top = (m, n) =>
    Array.from(m).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0] + "  ×" + Math.round(e[1]));
  const face = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      family: cs.fontFamily,
      size: round(cs.fontSize),
      weight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      tracking: cs.letterSpacing,
    };
  };
  const btn = document.querySelector(
    "a[class*=btn], a[class*=Btn], button, a[class*=button], a[class*=cta], [class*=Button]"
  );
  const bcs = btn && getComputedStyle(btn);
  const sections = Array.from(document.querySelectorAll("main > *, body > section, body > div > section")).slice(0, 12);

  return {
    title: document.title,
    palette: { background: top(bgArea, 6), text: top(textColor, 5) },
    type: { h1: face("h1"), h2: face("h2"), body: face("p") },
    button: bcs && { padding: bcs.padding, fontSize: round(bcs.fontSize), radius: bcs.borderRadius, weight: bcs.fontWeight },
    box: { radius: top(radius, 4), shadow: top(shadow, 3) },
    rhythm: {
      sectionPadding: sections.map((s) => getComputedStyle(s).paddingTop + " / " + getComputedStyle(s).paddingBottom),
      wideBoxes: Array.from(new Set(els.map((e) => Math.round(e.getBoundingClientRect().width))))
        .filter((w) => w > 600 && w < 1600)
        .sort((a, b) => b - a)
        .slice(0, 5),
    },
    motion: { animated, transitioned },
    imagery: {
      ratio: Math.round((imageArea / (innerWidth * document.body.scrollHeight)) * 100) + "%",
      imgCount: document.images.length,
    },
    pageHeight: document.body.scrollHeight,
  };
})()
```

**読み方の目安**（数値そのものではなく、どの側かを見る）：

| 測ったもの | 「詰まっている／静か」側 | 「ゆったり／賑やか」側 |
|---|---|---|
| `rhythm.sectionPadding` | 40px 以下 | 100px 以上 |
| `rhythm.wideBoxes` の最大 | 1100 未満 | 1300 以上 |
| `type.h1.size ÷ type.body.size` | 2.0 未満 | 3.0 以上 |
| `type.h1.tracking` | `normal` / 負 | `0.05em` 以上 |
| `box.radius` の最頻値 | 0〜4px | 16px 以上 |
| `imagery.ratio` | 15% 未満（文字で見せる） | 40% 以上（写真で見せる） |
| `motion.animated` | 0〜2（静止） | 10以上（動きが売り） |

### 2-4. 一文にまとめる

最後に、**その医院に行ったらどんな気持ちになるか**を日本語1〜2文で書く。これがそのまま `mood` になり、`selectTemplate` が読む**唯一の材料**になる。

> 例：「白と薄い木目で統一された、声のトーンが低い待合室。急かされない。年配の患者が多い内科。」

⚠️ `mood` に「青系」「余白広め」のような**実装の言葉を書かない**。雰囲気の言葉で書く。20文字を超えること（`verify-templates.mts` が落とす）。

---

## 3. 測った値をトークンに移す

### 使える語彙（全部。ここに無い値は書けない）

**`design.colors`**（すべて `#rrggbb`）
`primary` `accent` `light`（primaryの淡色＝交互セクションの地色） `background` `text` `primaryInverse` `accentInverse`

**`design.font`**
`headingFamily` / `bodyFamily`（CSSのfont-family文字列） / `googleFonts`（`["Noto Serif JP:wght@400;700"]`。⚠️ **空にすると外部リクエストゼロ**）/ `baseSize` 12–22 / `lineHeight` 1.2–2.4 / `headingWeight` 300–900 / `displayScale` 1–2.2（**見出しだけ**を拡大）/ `headingLetterSpacing` -0.02–0.3（em）

**`design.block`**
`radius` 0–48 / `borderWidth` 0–4 / `borderColor` / `shadow` `none|soft|strong` / `cardLayout` `grid|list|minimal|overlap` / `buttonScale` 0.8–1.8

**`design.layout`**
`heroLayout` `full-bleed|split|centered` / `maxWidth` 880–1440 / `spacingScale` 0.7–2 / `sectionDivider` `none|wave|diagonal` / `background` `plain|gradient|blobs|dots|grid` / `decoration` `none|accent|rich` / `rule` `none|hairline|accent-bar` / `ornament` `none|seigaiha|asanoha|dots-fine|hairlines|arc` / `ornamentStrength` 0–1 / `backdrop` `none|page|sections` / `backdropImage` / `styleKit`

**`design.chrome`**
`header` `bar|stacked|minimal` / `footer` `dark|light|compact|band`

**`design.animation`**
`reveal` `none|fade|slide-up|slide-left|slide-right|zoom|pop|flip|blur` / `duration` 0–2000 / `stagger` / `parallaxHero` / `variety`（セクションごとに向きを変える） / `ambient` `none|drift|float|sheen` / `progressBar`

### 対応表

| ご要望の項目 | どこに書くか |
|---|---|
| **Color** | `design.colors` の7つ |
| **Font** | `design.font.headingFamily` / `bodyFamily` / `googleFonts` |
| **Text Size** | `font.baseSize`（本文）＋ `font.displayScale`（見出しだけ）。個別に変えたいときは ブロックの `textStyles` |
| **Button Size** | `block.buttonScale` |
| **Padding / Margin** | `layout.spacingScale`（全体）／ブロックの `spacing`（そのセクションだけ）／`containerStyles` |
| **Look Image** | `mood` と `tags` |
| **Image** | ブロックの `data.image` など。空文字は写真なし |
| **Block の見せ方** | `block.cardLayout` ＋ ブロックの `variant` |
| **Section の見せ方** | ブロックの `variant`（次章の一覧） |
| **Background（ページ全体）** | `layout.background` ＋ `layout.backdrop`（写真） |
| **Background（セクションごと）** | 色 → `containerStyles.section.background` ／ 写真 → ブロックの `backgroundImage` ＋ `backgroundScrim` |
| **素材 / 地紋** | `layout.ornament` ＋ `ornamentStrength`（5種で足りなければ**スタイルキット**） |
| **Animation** | `animation.reveal` / `duration` / `stagger` / `variety` / `parallaxHero` |
| **きらきら / Interaction** | `animation.ambient`（3種）で足りなければ**スタイルキット**（6章） |

### セクションごとの背景写真

```jsonc
{ "id": "greeting", "type": "rich", "backgroundImage": "images/greeting-bg.jpg", "backgroundScrim": 0.78, ... }
```

- ⚠️ **`backgroundScrim` を 0.6 未満にしたセクションに本文を置かない。** `checkDesign` の配色検査はトークンどうししか比べられず、写真の上の文字は**構造的に測れない**。0.7前後なら写真が地紋として効きつつ文字が読める
- ⚠️ **1枚につき画像生成が1回課金される。** 使うのは1〜2セクションまで。`backgroundImage` を空にしたブロックにはスロットすら作られない（課金の門番）
- パスは `images/<ブロックID>-bg.jpg` の形にする。生成パイプラインがこの名前で書き戻す

---

## 4. セクションを決める

**セクションの並びは固定ではない。参考サイトの構成に合わせて毎回決める。**

### 4-1. まず LP 1枚にまとめる

⚠️ **参考サイトが何ページあっても、テンプレートは `pages` を home 1枚だけにする。** 各ページの中身をセクションとして home に並べる。理由は2つ：

- 個人クリニックの初回は1枚で足りることがほとんどで、ページを増やすと空のページができやすい
- 分けるのは後からいつでもできる（`pages` に足して `pageId` を振り直すだけ）。まとめ直すほうが難しい

### 4-2. 役割で箱を選ぶ

| 参考サイトにあるもの | 使う `type` | `variant` の選択肢 |
|---|---|---|
| ファーストビュー | `hero` | `full-bleed` / `split` / `centered` |
| 特徴・強み・診療内容（カードが並ぶ） | `rich` | `grid` / `list` / `minimal` / `overlap` |
| 長めの文章、院長挨拶、理念 | `freeText` | `plain` / `quote` / `rule` |
| 帯状の写真、標語だけの一枚 | `imageBanner` | （なし。`height` が `short` / `tall`） |
| 院内・設備の写真の集まり | `gallery` | `grid` / `masonry` / `marquee` |
| 診療時間の表 | `hours` | `table` / `stripe` / `card` |
| 料金表 | `pricing` | `table` / `cards` |
| 医師・スタッフ紹介 | `staff` | `grid` / `list` / `portrait` |
| よくある質問 | `faq` | `accordion` / `open` / `two-col` |
| お知らせ・新着 | `news` | `list` / `cards` |
| アクセス・地図 | `access` | `map-below` / `map-side` |
| 予約・問い合わせの締め | `contact` | `buttons` / `panel` / `band` |

⚠️ **合う箱が無いときは汎用の箱を使う。** `freeText`（見出し＋本文だけ）、`rich`（見出し＋本文＋カード）、`imageBanner`、`gallery` の4つは「クリニック特有の機能」を持たない容器で、参考サイトのどんなセクションにも当てられる。**新しいブロック型を作らない** — 型を1つ足すと、レンダラー・編集画面・画像台帳・検査の4か所に波及する。

⚠️ **`variant` の1番目は「そのブロックがずっと描いてきた形」。** 迷ったら1番目。並んだセクションが同じ variant を続けると1つの長いセクションに見えるので、`rich` が連続するときは変える。

### 4-3. 事実の箱には手を出さない

⚠️ **`hours` `pricing` `staff` `access` `faq` `news` の中身は、サイト生成時に `applyFactualContent` がヒアリングシートの内容で**そのまま上書き**する。** テンプレートに書いた行や料金は、実際の医院サイトには1文字も残らない。

つまり：

- 参考サイトに対応する役割が**無いのに置くと、その医院が情報を出さなかったときに空欄が並ぶ**。置かない
- テンプレートの中身は「レイアウトが成立して見える分量」を書く。3行の表を4行に増やしても意味は無い
- ⚠️ **`meta.phone` は必ず `00-0000-0000`、`meta.address` は必ず `〇〇` を含める。** もっともらしい電話番号は**実在の誰かの番号**になりうる。`verify-templates.mts` が落とす

### 4-4. ナビの名前

- 同じページのナビに**同じ言葉が2つ出ない**こと（`verify-templates.mts` が `navItems()` で測る）
- `navLabel` を空文字にすると「描くがナビには出さない」。hero と装飾的な帯はこれ
- ブロックの `data.heading` を空のまま残さない（同じく検査で落ちる）

---

## 5. frontend-design で作り直す

ここで `frontend-design` の指針を適用する。

⚠️ **`Skill` ツールでは呼べない。** 置き場所が `.agents/skills/` で、`Skill` が読むのは `.claude/skills/` だけ。**ファイルを直接読むこと**：

```
Read: .agents/skills/frontend-design/SKILL.md
```

⚠️ **渡すブリーフは「参考サイト」ではなく、2章で測った印象の要約と、その架空の医院の設定。** 参考サイトのURL・HTML・具体的な配色を持ち込まない（1章）。

`frontend-design` の言うとおり2パスで進める：

1. **トークン系をブレストする** — 4〜6色の名前つき配色、2つ以上の役割の書体、レイアウトの構想、そして signature（記憶に残る一点）
2. **既定っぽさを自己批評する** — 同じような依頼で自分が毎回たどり着く答えになっていないか。⚠️ AI生成デザインが必ず落ちる3つの型（クリーム地＋高コントラスト明朝＋テラコッタ／ほぼ黒地＋蛍光1色／新聞レイアウト＋角丸ゼロ）に嵌っていないか。嵌っていたら直して、何を変えたか言う
3. そのうえで JSON を書く

### この案件固有の制約（`frontend-design` の一般論に足すもの）

- **架空の医院を1つ考える。** 既存4件（みどり台ファミリークリニック／白河いつき皮膚科／青葉デンタルオフィス／こもれび眼科）と**名前が重複しない**こと。実在しそうでよいが、有名な病院・チェーンの名前は使わない
- **文章はその医院のもの。** 「ここにキャッチコピーが入ります」のような汎用の見本文を書かない。テンプレートが全部同じに見えていた原因がこれ
- **日本語。敬体。1文は短く。** 誇張（「最高の」「最先端の」）と効果の保証を書かない。HTMLタグ・マークダウン記号を書かない
- ⚠️ **書体は既存テンプレートと重複させない。** `frontend-design` の「毎回同じ書体に手が伸びていないか」がそのまま効く。書く前に `grep googleFonts src/lib/site/templates/*.json` で使用済みを確認する
- ⚠️ **全角と半角、日本語以外の混入に注意。** 過去に `satellite の区画` `простые な処置` のような混入が起きている（この手順書で作った最初のテンプレートでも `маウスピース` が出た）。**書き終えたら必ず機械的に走査する**：

```bash
python3 -c "
import json,unicodedata
d=json.load(open('src/lib/site/templates/<key>.json',encoding='utf-8'))
OK={'CJK','HIRAGANA','KATAKANA','FULLWIDTH','IDEOGRAPHIC','KATAKANA-HIRAGANA','LEFT','RIGHT','WAVE','HORIZONTAL','POSTAL','MIDDLE','BULLET','BLACK','WHITE','EM','HALFWIDTH'}
bad=[]
def w(v,p):
    if isinstance(v,dict):  [w(x,p+'.'+k) for k,x in v.items()]
    elif isinstance(v,list):[w(x,p+'['+str(i)+']') for i,x in enumerate(v)]
    elif isinstance(v,str):
        for c in v:
            if ord(c)>127 and unicodedata.name(c,'?').split()[0] not in OK: bad.append((p,c,unicodedata.name(c,'?')))
w(d,'')
print(bad or '非日本語の混入なし')
"
```

---

## 6. きらきら・動き・Interaction（スタイルキット）

`ornament` の5種と `ambient` の3種で足りるなら、それで済ませる。**足りないときだけ**、そのテンプレート専用のCSS/JSを書く。

### 置き方

`src/lib/render/kits/<key>.ts`：

```ts
import type { StyleKit } from "./index";
const css = `…`;
const js = `…`;              // 省略可。CSSで足りるならCSSだけにする
const kit: StyleKit = { css, js };
export default kit;
```

`src/lib/render/kits/index.ts` の `STYLE_KITS` に1行足し、テンプレートJSONに `"styleKit": "<key>"` と書く。

⚠️ **ドキュメントが持つのは「名前」だけで、CSSの中身ではない。** これは security の設計で、崩すと URL取り込み（＝任意の第三者サイトを読んだAIの出力）が、公開される医院のページにスクリプトを書き込める経路になる。詳しくは [kits/index.ts](../../../src/lib/render/kits/index.ts) の冒頭。

### 描く場所

`.ornament` を使う。site.css が用意した、**すでに安全な板**：

```
position: absolute; inset: 0; pointer-events: none;
親（.section）は overflow-x: clip
```

`background` は既定で透明なので、キットが好きに塗ってよい。`::before` / `::after` も自由に使える。

⚠️ **`.ornament` を塗る／動かすキットを使うテンプレートは、`layout.ornament` と `animation.ambient` を両方 `"none"` にすること。** site.css 側の地紋・常時アニメの規則は詳細度 (0,3,1) で、キット側には**絶対に勝てない**。同じ層を奪い合うと、キットの絵と動きが「なぜか出ない」という形で黙って消える（実測で踏んだ）。`verify-templates.mts` が落とす。

### 5つの制約（`verify-templates.mts` が機械的に測る）

1. **動かしてよいのは `.ornament` と擬似要素だけ。文字の入る箱は動かさない。**（`:hover` の間だけ動くのは可）
2. **`.nav-toggle` / `nav.site-nav` / ヘッダーの `position` に触れない。** モバイルメニューは `.nav-toggle:checked ~ nav.site-nav` という**隣接兄弟**の仕掛けで、ヘッダーを浮かせるとそのテンプレートから作られる全サイトの全ページでメニューが死ぬ
3. **390px で横にはみ出さない。** `100vw` と負のマージンを使わない
4. **`@media (prefers-reduced-motion: reduce)` を必ず書く。** ⚠️ site.css 冒頭の一括指定（`animation-duration: 0.01ms`）は **JSが書いた値も `background-attachment: fixed` も止められない**。手で切る
5. **色はテーマから取る**（`var(--primary)` / `var(--accent)` / `var(--bg)`）。生の hex はクリニックごとの色ずらし（`derivePalette`）を素通りして配色から外れる

### 手本

[`src/lib/render/kits/sparkle.ts`](../../../src/lib/render/kits/sparkle.ts) が「きらきら」の実装例で、5つの制約それぞれにどの行が対応するか注釈がついている。**新しいキットは空から書かず、これを複製して書き換える。**

JSを書くなら：`main.js` がすでに reveal 監視とスクロールバーを持っているので、**それを作り直さない**。安全な使い方は「カスタムプロパティを1つ書き、CSS側が読む」形（`sparkle.ts` の `--kit-scroll`）。要素を動かしたりマークアップを差し込んだりしない。

---

## 7. 書き出す

### JSONの形

`siteDocumentSchema` から**DBの都合のフィールド（`id`・時刻・所有者）を除いたもの**。新しい形を発明しない。

```jsonc
{
  "slug": "<英数字とハイフン。既存と重複しない>",
  "name": "<管理画面に出る名前>",
  "description": "<「ページ構成」セレクトの1行説明。空だと検査が落ちる>",
  "mood": "<2章4節で書いた雰囲気の一文。20文字超>",
  "tags": ["和モダン", "落ち着いた"],
  "design": { "colors": {…}, "font": {…}, "block": {…}, "layout": {…}, "chrome": {…}, "animation": {…} },
  "meta": { "clinicName": "…", "phone": "00-0000-0000", "address": "…〇〇…", "logoImage": "images/placeholder.svg", "seo": {…}, "snsLinks": [] },
  "pages": [{ "id": "home", "path": "", "navLabel": "ホーム", "title": "", "metaDescription": "", "inNav": true }],
  "blocks": [ … ]
}
```

### 忘れやすいところ

- ⚠️ **`index.ts` の import 1行。** `output: "standalone"` は import されないファイルを追跡しないので、忘れると **dev では動いて本番でだけテンプレートが1つ消える**。`verify-templates.mts` の1章がこれを見ている
- ⚠️ **ブロックIDは文書全体で一意。** HTMLのアンカーであると同時に、`slotKey()` 経由で**生成画像のファイル名**になる
- 画像パスは最初は `images/placeholder.svg`（写真は後で `illustrate-template.mts` が入れる）
- `slug` と `meta.clinicName` が既存4件と重複しないこと

### 既にD1に入っているテンプレートをファイルにしたいとき

```bash
npx tsx scripts/export-template.mts <slug> --key <ファイル名> --description "…"
```

---

## 8. 検証する

**課金なし・D1不要。ここまでは必ず全部通す。**

```bash
npx tsc --noEmit && npm run lint
```

```bash
npx tsx scripts/verify-templates.mts
```

```bash
npx tsx scripts/verify-archetypes.mts && npx tsx scripts/check-ornaments.mts && npx tsx scripts/check-variants.mts
```

**目で見る。** 開発サーバでテンプレートのプレビューを開き、**1280px と 390px** でスクリーンショットを撮る。参考サイトの同じ幅のスクリーンショットと**並べて**、次の1問に答える：

> **同じ種類の場所に見えるか。**

「同じサイトに見えるか」ではない（それは1章で捨てた）。「同じ性格の医院に見えるか」。

**課金あり。ユーザーの了解を得てから。**

```bash
npx tsx scripts/seed-template.mts <key>
npx tsx scripts/illustrate-template.mts <slug>
npx tsx scripts/check-design.mts --all
```

⚠️ 画像生成は1枚ずつ課金される。`illustrate-template.mts` は既定で主要な数枚だけ入れる。

---

## 9. やらないこと

- 参考サイトの**言葉・画像・ロゴ・具体的な配色・書体名**をテンプレートに入れない
- 参考サイトの画像を**ダウンロードしない・保存しない**（URLとして見るだけ）
- **新しいブロック型を作らない**（4章2節）
- **`meta.phone` を `00-0000-0000` 以外にしない**
- **既存テンプレートのブロックIDを変えない**（生成済みの写真が行方不明になる）
- Google Fonts 以外の**外部リクエストを増やさない**
- `src/lib/template/importFromUrl.ts` の防壁（`safeFetch.ts` のSSRF対策、`navLabel` 許可リスト）を**弱めない**
- ⚠️ **実在のクリニックのサイトを、そのままテンプレートとしてリポジトリに入れない。** 作るのは常に架空の医院
