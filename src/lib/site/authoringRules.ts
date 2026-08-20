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

/** Read by checkGuidelineCompliance's system prompt (src/lib/openai/checkGuidelineCompliance.ts). These
 * are the recurring categories of problem the 医療法 based advertising guideline for clinics/hospitals
 * flags, paraphrased for the model rather than quoted from the ministry document. This list is a
 * starting point for the AI reviewer's judgement, not a substitute for it — the guideline turns on
 * context (is a claim backed by evidence, is a photo accompanied by the required explanation) that a
 * fixed keyword list can't capture, which is why this feeds a model call rather than a regex scan. */
export const MEDICAL_AD_GUIDELINE_RULES = [
  "比較優良広告：他院より優れている、地域一番、No.1などの根拠のない比較・優劣表現。",
  "誇大広告：データや根拠のない「最高」「最新」等の強調、実態と異なる期待を抱かせる表現。",
  "断定的な効果の保証：「絶対に治る」「必ず成功する」など、治療結果を保証する表現。",
  "体験談：患者の体験談・感想を、効果や満足度を保証するものとして掲載すること。",
  "誤認させるおそれのある表現：治療の効果・安全性について、患者が実態以上に良いと誤解しうる表現（「痛みが全くない」「副作用が一切ない」等）。",
  "術前術後（ビフォーアフター）写真：治療内容・費用・リスク・副作用等の説明を伴わずに掲載すること。",
  "公序良俗に反する内容：品位を欠く、不安をあおる、差別的な表現。",
  "自由診療の費用表示：自由診療を掲載する場合、標準的な費用のほか、治療内容・治療期間や回数の目安、主なリスク・副作用の説明が欠けていること。",
];
