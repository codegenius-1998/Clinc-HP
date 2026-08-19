/** Content rules that govern every generated page, ported from hp-templates/SITE_SPEC.json when
 * templates moved into D1. They belong in code rather than in a template row because they are not a
 * design choice: an admin editing a template must not be able to switch off the rule that the AI may
 * never invent a clinic's phone number. */

/** Read by generateContentPlan's system prompt. The first rule is the load-bearing one: everything a
 * patient could act on (phone, address, hours, prices) comes from the hearing sheet or is not shown. */
export const HONESTY_RULES = [
  "電話番号・住所・LINE・診療時間・料金は hearing の実データのみを使用し、AIは絶対に創作しない。記載が無ければ該当箇所を非表示にする。",
  "お知らせ・よくある質問のみ、実データが無い場合にAIが一般的な内容を件数含めて生成してよい。",
  "資格・実績年数・症例数など、hearingに記載の無い具体的事実を創作しない。",
];

export const IMAGE_STYLE_RULES = [
  "全ての画像で被写体・図形をキャンバス端まで届かせる（edge-to-edge）。白い余白・フチ・レターボックスを作らない。",
  "実写系の画像は明るく清潔感のある医療機関らしい構図にする。人物の顔がはっきり分かるクローズアップは避ける。",
  "文字・ウォーターマークを画像内に入れない。",
];

export const LOGO_RULE =
  "医療系のモチーフ（聴診器・十字・ハート・葉・盾・波など、医院ごとに変える）のみを描く。医院名などの文字は画像に含めない（医院名はHTMLテキスト側で表示する）。背景は透過。";

export const SEO_DESCRIPTION_LENGTH = "100〜130字程度";
