import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { TemplateLayoutKnob, TemplateSection } from "@/lib/templates";
import type { ImageTarget } from "@/lib/htmlContent";

export type ImageStyle = "logo" | "icon" | "photo";

export type ImageGenerationPlan = {
  style: ImageStyle;
  prompt: string;
};

/** A repeatable content group (e.g. FAQ entries) whose item count isn't driven by structured hearing
 * data — the AI decides how many to render, within the template's declared bounds. */
export type RepeatableGroupInfo = {
  id: string;
  label: string;
  min: number;
  max: number;
  currentCount: number;
};

export type GenerationPlan = {
  /** section id -> show it or not. Only covers removable sections; others always stay visible. */
  sectionVisibility: Record<string, boolean>;
  /** image target id -> how to generate it and with what prompt. */
  imagePlans: Record<string, ImageGenerationPlan>;
  /** layout knob id -> new CSS value (written verbatim into the knob's cssVar). */
  layoutValues: Record<string, string>;
  /** repeatable group id -> chosen item count, within that group's declared min/max. */
  repeatableCounts: Record<string, number>;
  /** CSS rules only (no <style> tag) appended as the site's css/custom.css. */
  customCss: string;
};

const SYSTEM_PROMPT = `あなたはクリニックサイト制作のディレクター件AI画像プロンプトエンジニアです。
渡される資料をすべて踏まえ、次の5つを決定してください。

# 資料
- 「variables.jsonのガイド情報」: このテンプレート自身が持つ、セクション・画像・テキスト・リンクの役割に関する正式な仕様（sectionGuide/imageGuide/textGuide/linkGuide）。これが最優先の正本。
- 「_removed_images_manifest.md」: このテンプレートから削除されたサンプル画像の一覧（元のファイル名・サイズ・用途・参照箇所）。補足情報として使う。
- 「ヒアリングシート」: 今回作成するクリニックの実データ（医院の特徴・ご要望を含む）。
- 「セクション一覧」: このテンプレートが持つセクション（表示/非表示を切り替え可能なもの）。
- 「画像枠一覧」: 実際にページ上に配置されている画像（alt属性・class・タグ名つき）。
- 「レイアウト調整項目」: このテンプレートが公式にサポートするCSS変数の調整項目（カラム数・余白など、許容範囲つき）。
- 「現在のcustom.css」: 現在このサイトに適用されている追加CSS（通常は空）。

# 1. セクションの表示/非表示（sectionVisibility）
「セクション一覧」のうち非表示にできるものについて、表示するかどうかを判定すること。
- 基本方針は「表示のまま」。ヒアリングシートの情報だけでは全く埋められず、一般的な文章で埋めることも不自然（実在しない固有の実績・資格などが無いと成立しない等）なセクションのみ非表示にすること。
- 迷った場合は表示のままにすること。

# 2. 画像の生成プラン（imagePlans）
渡された「画像枠一覧」の画像1件ごとに、variables.jsonのガイド情報とマニフェストからその画像の本来の役割を読み取り、次を決めること。
- style: "logo"（サイトロゴ・ブランドマーク）/ "icon"（小さな装飾アイコン・バナー等の非写実的な画像）/ "photo"（実写風の写真）
- prompt: 実際に画像生成AIに渡す英語のプロンプト。役割・ヒアリングシートの情報（医院名・特徴など）を反映すること。
  - style が "logo" の場合: 約128×128の正方形・透明背景の医療系マークのみ。医院名などの文字は画像に描かない（医院名はHTML側で表示する）。十字パステル固定デザインは使わない。診療科・特徴・要望から毎回異なる医療モチーフ（聴診器・ハート・十字・葉・盾・波・パルスなど）を選び、似た構図の量産を避けること。
  - style が "icon" の場合: 同様にフラットなベクター調のシンプルな装飾画像。写実的にしないこと。
  - style が "photo" の場合: 明るく清潔感のある医療機関らしい実写風の写真。人物の顔がはっきり写る描写は避け、文字・ウォーターマークを含めないこと。
- 「画像枠一覧」に実寸（幅x高さ・アスペクト比）が付いている画像は、そのアスペクト比に合った構図をpromptに明記すること（例: 横長バナーなら "wide horizontal banner composition"、正方形に近いなら "centered square composition"）。実際の生成サイズはシステム側がこの実寸に合わせて指定するため、画像そのものが正方形になる想定でプロンプトを書かないこと。

# 3. 繰り返し項目の件数（repeatableCounts）
「繰り返し項目一覧」の各項目（例: よくある質問のQ&A件数）について、min〜maxの範囲内で適切な件数を整数で決めること。
- ヒアリングシートの情報量（特徴・要望の充実度）に応じて、自然に感じる件数にすること。
- 迷った場合は「現在の件数」をそのまま返すこと。

# 4. レイアウト調整（layoutValues）
「レイアウト調整項目」の各キーについて、新しい値を決めること。
- 数値項目（min/maxが指定されているもの）は、必ずその範囲内の整数を文字列で返すこと（例: "3"）。
- 数値以外（余白などのCSS長さ）は、元の値から大きく外れない範囲で、そのクリニックの雰囲気（例: 要望に「ゆったり」とあれば余白を広めに）に合わせて調整すること（例: "6vw"）。
- 迷った場合は元の値をそのまま返すこと。

# 5. 追加CSS（customCss）
医院の特徴・ご要望から感じ取れる雰囲気（やさしい/信頼感/親しみやすい/先進的 等）を反映する、装飾レベルの追加CSSを作成すること。
- 使ってよい変更: 角丸（border-radius）、影（box-shadow）、余白の微調整、フォントの太さ・文字間（font-weight, letter-spacing）、ボーダースタイル、既存のCSS変数（--primary-color, --accent-color, --light-color 等）を使った配色の微調整。
- 使ってはいけない変更: レイアウト構造を壊すもの（display, position, width, flex, grid, float の変更）、既存セレクタの非表示化、フォント自体の変更、!important の乱用。
- 要望が特に無ければ、無理に個性を出そうとせず、最小限（数行程度）でよい。CSSルールのみを出力し、<style>タグや説明文は含めないこと。

出力は "sectionVisibility"・"imagePlans"・"repeatableCounts"・"layoutValues"・"customCss" のみを持つオブジェクト。`;

function buildUserPrompt(
  hearing: HearingSheet,
  removableSections: TemplateSection[],
  imageTargets: ImageTarget[],
  imageSizeHints: Record<string, { width: number; height: number }>,
  layout: Record<string, TemplateLayoutKnob>,
  repeatableGroups: RepeatableGroupInfo[],
  currentCustomCss: string,
  guideSummary: string,
  imageManifest: string
): string {
  const infoLines = [
    `クリニック名: ${hearing.clinicName}`,
    hearing.directorName && `院長名: ${hearing.directorName}`,
    hearing.address && `住所: ${hearing.address}`,
    hearing.department && `診療科: ${hearing.department}`,
    hearing.hours && `診療時間: ${hearing.hours}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    hearing.request && `ご要望: ${hearing.request}`,
  ].filter((line): line is string => Boolean(line));

  const sectionLines = removableSections.map((s) => `- id: ${s.id} / ラベル: ${s.label}`);
  const imageLines = imageTargets.map((t) => {
    const size = imageSizeHints[t.id];
    const sizeText = size ? ` / 実寸: ${size.width}x${size.height}（アスペクト比 約${(size.width / size.height).toFixed(2)}:1）` : "";
    return `- id: ${t.id} / パス: ${t.path} / alt: 「${t.alt || "(なし)"}」 / class: ${t.className || "(なし)"}${sizeText}`;
  });
  const layoutLines = Object.entries(layout).map(
    ([key, knob]) =>
      `- id: ${key} / ラベル: ${knob.label} / 現在値: ${knob.value} / CSS変数: ${knob.cssVar}` +
      (knob.min !== undefined && knob.max !== undefined ? ` / 範囲: ${knob.min}〜${knob.max}` : "")
  );
  const repeatableLines = repeatableGroups.map(
    (g) => `- id: ${g.id} / ラベル: ${g.label} / 現在の件数: ${g.currentCount} / 範囲: ${g.min}〜${g.max}`
  );

  return [
    `# variables.jsonのガイド情報`,
    guideSummary || "(なし)",
    ``,
    `# _removed_images_manifest.md`,
    imageManifest || "(なし)",
    ``,
    `# ヒアリングシート`,
    ...infoLines,
    ``,
    `# セクション一覧（非表示にできるもののみ）`,
    ...(sectionLines.length > 0 ? sectionLines : ["(なし)"]),
    ``,
    `# 画像枠一覧`,
    ...(imageLines.length > 0 ? imageLines : ["(なし)"]),
    ``,
    `# レイアウト調整項目`,
    ...(layoutLines.length > 0 ? layoutLines : ["(なし)"]),
    ``,
    `# 繰り返し項目一覧`,
    ...(repeatableLines.length > 0 ? repeatableLines : ["(なし)"]),
    ``,
    `# 現在のcustom.css`,
    currentCustomCss.trim() || "(空)",
  ].join("\n");
}

export async function planGeneration(
  hearing: HearingSheet,
  sections: TemplateSection[],
  imageTargets: ImageTarget[],
  imageSizeHints: Record<string, { width: number; height: number }>,
  layout: Record<string, TemplateLayoutKnob>,
  repeatableGroups: RepeatableGroupInfo[],
  currentCustomCss: string,
  guideSummary: string,
  imageManifest: string
): Promise<GenerationPlan> {
  const removableSections = sections.filter((s) => s.removable);
  const layoutEntries = Object.entries(layout);

  if (
    removableSections.length === 0 &&
    imageTargets.length === 0 &&
    layoutEntries.length === 0 &&
    repeatableGroups.length === 0
  ) {
    return { sectionVisibility: {}, imagePlans: {}, layoutValues: {}, repeatableCounts: {}, customCss: "" };
  }

  const shape: Record<string, z.ZodTypeAny> = {
    customCss: z.string(),
  };
  if (removableSections.length > 0) {
    shape.sectionVisibility = z.object(Object.fromEntries(removableSections.map((s) => [s.id, z.boolean()])));
  }
  if (imageTargets.length > 0) {
    shape.imagePlans = z.object(
      Object.fromEntries(
        imageTargets.map((t) => [
          t.id,
          z.object({ style: z.enum(["logo", "icon", "photo"]), prompt: z.string() }),
        ])
      )
    );
  }
  if (layoutEntries.length > 0) {
    shape.layoutValues = z.object(Object.fromEntries(layoutEntries.map(([key]) => [key, z.string()])));
  }
  if (repeatableGroups.length > 0) {
    shape.repeatableCounts = z.object(Object.fromEntries(repeatableGroups.map((g) => [g.id, z.number()])));
  }
  const schema = z.object(shape);

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(
          hearing,
          removableSections,
          imageTargets,
          imageSizeHints,
          layout,
          repeatableGroups,
          currentCustomCss,
          guideSummary,
          imageManifest
        ),
      },
    ],
    text: { format: zodTextFormat(schema, "generation_plan") },
  });

  const parsed = response.output_parsed as
    | {
        sectionVisibility?: Record<string, boolean>;
        imagePlans?: Record<string, ImageGenerationPlan>;
        layoutValues?: Record<string, string>;
        repeatableCounts?: Record<string, number>;
        customCss?: string;
      }
    | null;
  if (!parsed) {
    throw new Error("生成プランの作成に失敗しました。");
  }

  return {
    sectionVisibility: parsed.sectionVisibility ?? {},
    imagePlans: parsed.imagePlans ?? {},
    layoutValues: parsed.layoutValues ?? {},
    repeatableCounts: parsed.repeatableCounts ?? {},
    customCss: parsed.customCss ?? "",
  };
}
