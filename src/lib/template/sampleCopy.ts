import type { Block, SiteMeta } from "@/lib/site/document";
import type { SampleCopy } from "@/lib/openai/generateSampleCopy";

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
          // ⚠️ block.cardCount, not a hardcoded 4. An archetype that asks for a 3-up or 6-up grid
          // would otherwise have its choice silently overwritten here — the sample copy would say
          // four cards no matter what the layout was designed around.
          data: { ...block.data, body: SAMPLE_BODY, cards: sampleCards(block.cardCount ?? 4) },
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
      case "freeText":
        return {
          ...block,
          data: {
            ...block.data,
            body: "医院の考え方や姿勢を、短い文章で伝える区切りです。写真を使わずに、ページの調子を変える役割を持ちます。",
          },
        };
      // Only filled when the template left it empty: a template that specifies its own photo count
      // (a 2-up gallery, say) is making a layout decision that sample copy must not overwrite.
      case "gallery":
        return block.data.images.length > 0
          ? block
          : {
              ...block,
              data: {
                ...block.data,
                images: Array.from({ length: 4 }, () => ({ src: "images/placeholder.svg" })),
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


/** Writes a generated sample into a template's blocks and meta.
 *
 * Runs AFTER `applySampleCopy`, never instead of it: the hand-written pass fills every field, and
 * this replaces the ones the model actually wrote. A model that skips a section leaves the generic
 * words there rather than a hole.
 *
 * ⚠️ Phone, address, price rows and opening hours are NOT touched, deliberately. They stay the
 * obviously-fake `00-0000-0000` / 〇〇 placeholders this app has always used. A template preview that
 * carries a plausible-looking phone number is carrying somebody's real number, and a plausible price
 * list is a claim about a business that does not exist. The words may vary; the facts may not.
 *
 * ⚠️ `applyFactualContent` overwrites hours, prices, staff, news, FAQ and address from the real
 * hearing sheet when a clinic's site is generated, so nothing written here can reach a live site. */
export function applyGeneratedSampleCopy(blocks: Block[], meta: SiteMeta, copy: SampleCopy): Block[] {
  const byId = new Map(copy.blocks.map((b) => [b.blockId, b]));

  if (copy.clinicName.trim()) {
    meta.clinicName = copy.clinicName.trim();
    meta.seo.ogSiteName = meta.clinicName;
    meta.seo.title = `${meta.clinicName}｜テンプレートプレビュー`;
    meta.seo.ogTitle = meta.clinicName;
  }

  return blocks.map((block): Block => {
    const written = byId.get(block.id);

    switch (block.type) {
      case "hero":
        return copy.heroHeadline.trim()
          ? {
              ...block,
              data: { ...block.data, headline: copy.heroHeadline, subheadline: copy.heroSubheadline },
            }
          : block;

      case "rich":
        if (!written) return block;
        return {
          ...block,
          data: {
            ...block.data,
            heading: written.heading || block.data.heading,
            body: written.body || block.data.body,
            // Keeps each card's image path — the model writes words, not pictures.
            cards:
              written.cards.length > 0
                ? written.cards.map((card, i) => ({
                    ...(block.data.cards[i] ?? { image: block.data.cards[0]?.image }),
                    heading: card.heading,
                    body: card.body,
                  }))
                : block.data.cards,
          },
        };

      case "freeText":
        if (!written) return block;
        return { ...block, data: { ...block.data, heading: written.heading, body: written.body || block.data.body } };

      case "contact":
        return {
          ...block,
          data: {
            ...block.data,
            heading: written?.heading || block.data.heading,
            lead: copy.contactLead || block.data.lead,
          },
        };

      case "gallery":
        return written?.heading ? { ...block, data: { ...block.data, heading: written.heading } } : block;

      case "staff":
        return copy.staff.length > 0
          ? {
              ...block,
              data: {
                ...block.data,
                members: copy.staff.slice(0, 4).map((member, i) => ({
                  ...(block.data.members[i] ?? { image: "images/placeholder.svg" }),
                  name: member.name,
                  role: member.role,
                  comment: member.comment,
                })),
              },
            }
          : block;

      case "news":
        return copy.news.length > 0 ? { ...block, data: { ...block.data, items: copy.news.slice(0, 4) } } : block;

      case "faq":
        return copy.faq.length > 0 ? { ...block, data: { ...block.data, items: copy.faq.slice(0, 5) } } : block;

      case "hours":
        // ⚠️ `rows` は触らない。診療時間そのものは架空でも「もっともらしい事実」になってしまう。
        return copy.hoursNote ? { ...block, data: { ...block.data, note: copy.hoursNote } } : block;

      default:
        return block;
    }
  });
}
