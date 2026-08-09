import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import type { HearingSheet } from "@/lib/hearing";
import type { TextTarget } from "@/lib/htmlContent";
import { HIDDEN_TEXT_VALUE } from "@/lib/htmlContent";

const SYSTEM_PROMPT = `あなたはクリニック・医療機関のWebサイト制作を数多く手がけてきたコピーライターです。
渡される「ページ内のテキスト要素一覧」は、実在するテンプレートHTMLから機械的に抽出した、書き換え対象のテキスト要素です（idごとに元のタグ名・class・現在のテキスト（テンプレートのサンプル文言）が分かります）。
「ヒアリングシート」の内容をもとに、要素ごとの書き換え後テキストを1つずつ作成してください。

# 出力形式
渡された要素のid をキーとするオブジェクト。値はその要素にそのまま入れる文字列（前後の説明・記号・引用符は不要）。

# 不明確な情報の扱い（最重要）
- その要素に入れるべき内容が「ヒアリングシート」の情報だけでは明確に判断できない場合、絶対に推測・創作してはならない。その場合は値として文字列 "${HIDDEN_TEXT_VALUE}" を返すこと（この要素は自動的に非表示になる）。
- 特に、電話番号・住所・LINE・受付時間（診療時間）を表示している要素、またはそれらのラベル（例:「TEL」「電話」「住所」「アクセス」「受付時間」「診療時間」「LINE」）に対応する値だと判断できる要素は、「ヒアリングシート」に記載があれば必ずその値をそのまま（一字一句変更せず）入れ、記載が無ければ必ず "${HIDDEN_TEXT_VALUE}" を返すこと。実在するかのような番号・住所・時間を創作することは固く禁止する。
- 例外: ヘッダーの address 内 .small（受付時間）は、ヒアリングの診療時間から「平日」の時間だけを短く抜き出して表示すること（例:「受付時間：平日 AM9:00〜PM7:00」）。土日祝や曜日表全体は入れない。平日分が判断できなければ "${HIDDEN_TEXT_VALUE}"。
- 資格・実績年数・症例数など、記載の無い具体的事実についても同様に、創作せず "${HIDDEN_TEXT_VALUE}" を返すこと。

# 一般的なコピーのルール
- 上記に当てはまらない一般的なコピー（見出し・紹介文・特徴・案内文・ボタン文言など）は、「医院の特徴」「ご要望」の内容を反映して自然な日本語のクリニックサイトらしい文言に書き換えること。
- ナビゲーションラベルや著作権表記など、書き換えの必要が薄い要素は、無理に変えず現在の文言に近い自然な表現のままにしてよい（"${HIDDEN_TEXT_VALUE}" にする必要は無い）。
- 各要素は、元の役割・文字数バランスを大きく崩さない範囲で書き換えること（見出しは短く、本文は元のボリューム感を保つ）。`;

function buildUserPrompt(hearing: HearingSheet, targets: TextTarget[]): string {
  const infoLines = [
    `クリニック名: ${hearing.clinicName}`,
    hearing.directorName && `院長名: ${hearing.directorName}`,
    hearing.address && `住所: ${hearing.address}`,
    hearing.phone && `電話番号: ${hearing.phone}`,
    hearing.line && `LINE: ${hearing.line}`,
    hearing.department && `診療科: ${hearing.department}`,
    hearing.hours && `診療時間（受付時間）: ${hearing.hours}`,
    hearing.features && `医院の特徴: ${hearing.features}`,
    hearing.request && `ご要望: ${hearing.request}`,
  ].filter((line): line is string => Boolean(line));

  const targetLines = targets.map(
    (t) => `- id: ${t.id} / タグ: ${t.tag} / class: ${t.className || "(なし)"} / 現在のテキスト: 「${t.text}」`
  );

  return [`# ヒアリングシート`, ...infoLines, ``, `# ページ内のテキスト要素一覧`, ...targetLines].join("\n");
}

export async function generateSiteCopy(hearing: HearingSheet, targets: TextTarget[]): Promise<Record<string, string>> {
  if (targets.length === 0) {
    return {};
  }

  const shape = Object.fromEntries(targets.map((target) => [target.id, z.string()]));
  const schema = z.object(shape);

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(hearing, targets) },
    ],
    text: { format: zodTextFormat(schema, "site_copy") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("テキストの生成に失敗しました。");
  }

  return parsed as Record<string, string>;
}
