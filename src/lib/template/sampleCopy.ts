import type { Block } from "@/lib/site/document";

/** Neutral placeholder copy for a freshly imported template.
 *
 * Written by hand rather than by the model, for three reasons: a template preview should read as a
 * template (obviously generic, so nobody mistakes it for a real clinic's page), it costs nothing,
 * and it is identical across templates — which is what makes two templates visually comparable at a
 * glance. The clinic-specific copy is written later, per site, by generateContentPlan. */

const SAMPLE_BODY =
  "ここにはセクションの説明文が入ります。実際のサイトでは、ヒアリングシートの内容をもとにAIが医院ごとの文章を書きます。";

function sampleCards(count: number): { heading: string; body: string; image?: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    heading: `項目${i + 1}`,
    body: "カードの本文が入ります。診療内容や特徴を1〜2文で紹介します。",
    image: "images/placeholder.svg",
  }));
}

export function applySampleCopy(blocks: Block[]): Block[] {
  return blocks.map((block): Block => {
    switch (block.type) {
      case "hero":
        return {
          ...block,
          data: {
            headline: "ここにキャッチコピーが入ります",
            subheadline: "サブコピーが1行入ります。医院の雰囲気や立地を短く伝えます。",
            image: "images/placeholder.svg",
          },
        };
      case "rich":
        return {
          ...block,
          data: { ...block.data, body: SAMPLE_BODY, cards: sampleCards(4) },
        };
      case "hours":
        return {
          ...block,
          data: {
            ...block.data,
            rows: [
              { label: "月・火・水・金", value: "9:00〜12:30 / 15:00〜18:30" },
              { label: "木・土", value: "9:00〜12:30" },
              { label: "休診日", value: "日曜・祝日" },
            ],
            note: "受付は診療終了の15分前までです。",
          },
        };
      case "access":
        return {
          ...block,
          data: { ...block.data, address: "東京都〇〇区〇〇 1-2-3 〇〇ビル2F", mapQuery: "" },
        };
      case "news":
        return {
          ...block,
          data: {
            ...block.data,
            items: [
              { date: "2026.04.01", title: "お知らせのタイトルがここに入ります" },
              { date: "2026.03.15", title: "2件目のお知らせのタイトル" },
            ],
          },
        };
      case "staff":
        return {
          ...block,
          data: {
            ...block.data,
            members: [
              { name: "山田 太郎", role: "院長", comment: "スタッフの紹介文が入ります。", image: "images/placeholder.svg" },
              { name: "佐藤 花子", role: "看護師", comment: "スタッフの紹介文が入ります。", image: "images/placeholder.svg" },
              { name: "鈴木 一郎", role: "受付", comment: "スタッフの紹介文が入ります。", image: "images/placeholder.svg" },
            ],
          },
        };
      case "pricing":
        return {
          ...block,
          data: {
            ...block.data,
            items: [
              { name: "自由診療メニューA", price: "0,000円" },
              { name: "自由診療メニューB", price: "0,000円", note: "税込" },
            ],
          },
        };
      case "faq":
        return {
          ...block,
          data: {
            ...block.data,
            items: [
              { question: "質問のテキストがここに入ります", answer: "回答のテキストがここに入ります。" },
              { question: "2つ目の質問のテキスト", answer: "2つ目の回答のテキストが入ります。" },
            ],
          },
        };
      default:
        return block;
    }
  });
}
