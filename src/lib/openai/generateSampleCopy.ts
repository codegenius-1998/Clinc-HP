import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import { CARD_COUNT_RANGE } from "@/lib/site/composition";
import type { Block, SiteDocument } from "@/lib/site/document";

/** Writes one template's sample content: a fictional clinic and the words on its page.
 *
 * A template imported from a reference site borrows a SHAPE and has no words of its own. Until now
 * every one of them was filled from `sampleCopy.ts` — the same 「ここにキャッチコピーが入ります」,
 * the same 項目1／項目2／項目3, the same 山田 太郎 — so however different two templates' colours and
 * section orders were, every word a reader's eye landed on was identical, and they read as one page
 * in two palettes. This gives each one its own voice.
 *
 * ⚠️ THIS CALL NEVER SEES THE REFERENCE SITE. Not its HTML, not its CSS, not its image URLs, not its
 * title. That is the load-bearing property of this module, and it replaces a defence the schema used
 * to provide: the reason a URL import could not copy a clinic's prose was that there was nowhere in
 * `aiTemplateSchema` to put a sentence. Once sentences are being written, that defence is gone, so
 * it is rebuilt as an information barrier instead — the request that writes the words does not hold
 * the material that could be copied. A model cannot reproduce what it was not given.
 *
 * The inputs are therefore only: the atmosphere the design analysis settled on (`mood`, `tags`) and
 * the skeleton (block ids, types, how many cards). Nothing that came off the reference page. */

const cardSchema = z.object({ heading: z.string(), body: z.string() });

const blockCopySchema = z.object({
  blockId: z.string(),
  heading: z.string(),
  body: z.string(),
  cards: z.array(cardSchema),
});

const sampleCopySchema = z.object({
  /** The fictional clinic this template's preview presents itself as. */
  clinicName: z.string(),
  heroHeadline: z.string(),
  heroSubheadline: z.string(),
  blocks: z.array(blockCopySchema),
  staff: z.array(z.object({ name: z.string(), role: z.string(), comment: z.string() })),
  news: z.array(z.object({ date: z.string(), title: z.string() })),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
  hoursNote: z.string(),
  contactLead: z.string(),
});

export type SampleCopy = z.infer<typeof sampleCopySchema>;

/** Types whose text this writes. The fact-carrying ones (診療時間の行・料金・住所) are NOT here: a
 * template's hours and prices are placeholders that `applyFactualContent` overwrites from the real
 * hearing sheet, and inventing plausible ones would only make a preview look like a real business. */
const SYSTEM_PROMPT = `あなたはクリニックのホームページの「見本」を作るコピーライターです。
実在しない架空のクリニックを1つ考え、そのサイトに載る文章を書いてください。出力はJSONのみです。

# これは見本です
- ここで書く文章は、テンプレートのプレビューに表示されるサンプルです。実際の医院の文章ではありません。
- 架空の医院名を1つ考えてください。実在しそうな自然な名前で構いませんが、有名な病院・チェーン・企業の名前は使わないこと。
- 電話番号・住所・料金・診療時間の具体的な数字は書かないでください（それらはこちらで固定のダミーを入れます）。

# 文章の書き方
- 日本語。敬体（です・ます）。1文は短く。
- キャッチコピーは20文字前後。説明くさくせず、その医院の姿勢が伝わる一文にすること。
- セクションの本文は1〜2文（60〜100文字）。カードの本文は1文（30〜50文字）。
- 「最高の」「最先端の」「日本一の」のような誇張や、効果を保証する表現は使わないこと。
- HTMLタグ・マークダウン記号は一切書かないこと。改行したい場合も <br> は書かない。

# 雰囲気に合わせる
- 渡された「雰囲気」に合う診療科と語り口を選んでください。落ち着いた雰囲気なら落ち着いた文章、親しみやすい雰囲気なら柔らかい文章にすること。
- スタッフは3名まで。架空の氏名と役職（院長・看護師・受付など）、1文の紹介文。
- お知らせは2〜3件。日付は「2026.04.01」の形式で、季節や休診の案内など当たり障りのない内容にすること。
- よくある質問は2〜3件。予約・保険・持ち物など、どの医院にもある一般的な内容にすること。`;

/** Block types this asks the model to write. Mirrors AUTHORABLE_TYPES in generateContentPlan. */
const AUTHORABLE = new Set<Block["type"]>(["hero", "rich", "freeText", "contact", "gallery"]);

function describeSkeleton(blocks: Block[]): string {
  return blocks
    .filter((block) => AUTHORABLE.has(block.type))
    .map((block) => {
      const cards = block.type === "rich" ? block.data.cards.length || (block.cardCount ?? 3) : 0;
      const role = block.navLabel || (block.type === "hero" ? "冒頭" : "区切り");
      return `- ${block.id}（${block.type}／${role}）${cards > 0 ? `／カード${cards}枚` : ""}`;
    })
    .join("\n");
}

/** Returns null rather than throwing.
 *
 * ⚠️ A template import has already spent a model call, several seconds of fetching and (since the
 * photographs became automatic) real money by the time this runs. Failing the whole import because
 * the sample wording could not be written would be absurd — the caller falls back to the hand-written
 * `applySampleCopy`, which is exactly what every template had until now. */
export async function generateSampleCopy(doc: SiteDocument): Promise<SampleCopy | null> {
  const skeleton = describeSkeleton(doc.blocks);
  if (skeleton.length === 0) return null;

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.parse({
      model: "gpt-5.6-terra",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          // ⚠️ Everything in this string is ours: the mood sentence the design analysis produced, our
          // own tag list, and our own block ids. Nothing here came off the reference page.
          content:
            `# このテンプレートの雰囲気\n${doc.mood ?? "清潔感があり、初めての患者にも安心感を与えるトーン。"}\n\n` +
            `# タグ\n${doc.tags.join("、") || "（なし）"}\n\n` +
            `# 文章を入れるセクション\n${skeleton}\n\n` +
            `カードは1セクションにつき指定された枚数ちょうど書いてください（${CARD_COUNT_RANGE.min}〜${CARD_COUNT_RANGE.max}枚）。`,
        },
      ],
      text: { format: zodTextFormat(sampleCopySchema, "sample_copy") },
    });
    return (response.output_parsed as SampleCopy | null) ?? null;
  } catch (err) {
    console.warn("[generateSampleCopy] サンプル文章を書けませんでした。共通の見本文で続けます。", err);
    return null;
  }
}
