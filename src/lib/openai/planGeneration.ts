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

export type GenerationPlan = {
  /** section id -> show it or not. Only covers removable sections; others always stay visible. */
  sectionVisibility: Record<string, boolean>;
  /** image target id -> how to generate it and with what prompt. */
  imagePlans: Record<string, ImageGenerationPlan>;
  /** layout knob id -> new CSS value (written verbatim into the knob's cssVar). */
  layoutValues: Record<string, string>;
  /** CSS rules only (no <style> tag) appended as the site's css/custom.css. */
  customCss: string;
};

const SYSTEM_PROMPT = `あなたはクリニックサイト制作のディレクター件AI画像プロンプトエンジニアです。
渡される資料をすべて踏まえ、次の4つを決定してください。

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
  - style が "logo" の場合: 実写ではなく、フラットなベクター調のロゴマーク。読める文字・単語を含めないこと（画像生成AIは正確な文字を描画できないため）。医療・クリニックを連想させるシンプルな図形（十字・葉・円などのミニマルなモチーフ）を使うこと。
  - style が "icon" の場合: 同様にフラットなベクター調のシンプルな装飾画像。写実的にしないこと。
  - style が "photo" の場合: 明るく清潔感のある医療機関らしい実写風の写真。人物の顔がはっきり写る描写は避け、文字・ウォーターマークを含めないこと。

# 3. レイアウト調整（layoutValues）
「レイアウト調整項目」の各キーについて、新しい値を決めること。
- 数値項目（min/maxが指定されているもの）は、必ずその範囲内の整数を文字列で返すこと（例: "3"）。
- 数値以外（余白などのCSS長さ）は、元の値から大きく外れない範囲で、そのクリニックの雰囲気（例: 要望に「ゆったり」とあれば余白を広めに）に合わせて調整すること（例: "6vw"）。
- 迷った場合は元の値をそのまま返すこと。

# 4. 追加CSS（customCss）
医院の特徴・ご要望から感じ取れる雰囲気（やさしい/信頼感/親しみやすい/先進的 等）を反映する、装飾レベルの追加CSSを作成すること。
- 使ってよい変更: 角丸（border-radius）、影（box-shadow）、余白の微調整、フォントの太さ・文字間（font-weight, letter-spacing）、ボーダースタイル、既存のCSS変数（--primary-color, --accent-color, --light-color 等）を使った配色の微調整。
- 使ってはいけない変更: レイアウト構造を壊すもの（display, position, width, flex, grid, float の変更）、既存セレクタの非表示化、フォント自体の変更、!important の乱用。
- 要望が特に無ければ、無理に個性を出そうとせず、最小限（数行程度）でよい。CSSルールのみを出力し、<style>タグや説明文は含めないこと。

出力は "sectionVisibility"・"imagePlans"・"layoutValues"・"customCss" のみを持つオブジェクト。`;

function buildUserPrompt(
  hearing: HearingSheet,
  removableSections: TemplateSection[],
  imageTargets: ImageTarget[],
  layout: Record<string, TemplateLayoutKnob>,
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
  const imageLines = imageTargets.map(
    (t) => `- id: ${t.id} / パス: ${t.path} / alt: 「${t.alt || "(なし)"}」 / class: ${t.className || "(なし)"}`
  );
  const layoutLines = Object.entries(layout).map(
    ([key, knob]) =>
      `- id: ${key} / ラベル: ${knob.label} / 現在値: ${knob.value} / CSS変数: ${knob.cssVar}` +
      (knob.min !== undefined && knob.max !== undefined ? ` / 範囲: ${knob.min}〜${knob.max}` : "")
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
    `# 現在のcustom.css`,
    currentCustomCss.trim() || "(空)",
  ].join("\n");
}

export async function planGeneration(
  hearing: HearingSheet,
  sections: TemplateSection[],
  imageTargets: ImageTarget[],
  layout: Record<string, TemplateLayoutKnob>,
  currentCustomCss: string,
  guideSummary: string,
  imageManifest: string
): Promise<GenerationPlan> {
  const removableSections = sections.filter((s) => s.removable);
  const layoutEntries = Object.entries(layout);

  if (removableSections.length === 0 && imageTargets.length === 0 && layoutEntries.length === 0) {
    return { sectionVisibility: {}, imagePlans: {}, layoutValues: {}, customCss: "" };
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
          layout,
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
    customCss: parsed.customCss ?? "",
  };
}
