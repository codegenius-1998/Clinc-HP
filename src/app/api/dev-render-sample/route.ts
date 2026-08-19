// TEMPORARY dev-only route: renders a hand-built SiteDocument so the block renderer can be verified
// without spending an OpenAI call. Delete once the editor exists.
import { buildDefaultTemplate } from "@/lib/site/defaultTemplate";
import { renderSiteFiles } from "@/lib/render/renderSiteFiles";
import type { SiteDocument } from "@/lib/site/document";

export async function GET() {
  const template = buildDefaultTemplate();
  const doc: SiteDocument = {
    ...template,
    id: "sample",
    slug: "sample-preview",
    isTemplate: false,
    name: "さくら内科クリニック",
    meta: {
      clinicName: "さくら内科クリニック",
      phone: "03-1234-5678",
      line: "@sakura",
      address: "東京都渋谷区桜丘町1-2-3 さくらビル2F",
      logoImage: "https://placehold.co/128x128/4ba3fc/ffffff?text=S",
      seo: {
        title: "さくら内科クリニック｜渋谷の内科・呼吸器内科",
        metaDescription: "渋谷駅徒歩3分の内科クリニックです。",
        ogTitle: "さくら内科クリニック",
        ogDescription: "渋谷駅徒歩3分の内科クリニック",
        ogSiteName: "さくら内科クリニック",
      },
      snsLinks: [],
    },
    blocks: template.blocks.map((block) => {
      const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/900`;
      switch (block.type) {
        case "hero":
          return {
            ...block,
            data: {
              headline: "かかりつけ医として、地域の毎日を支えます",
              subheadline: "渋谷駅から徒歩3分。内科・呼吸器内科・アレルギー科。",
              image: "https://picsum.photos/seed/hero/1200/600",
            },
          };
        case "rich":
          return {
            ...block,
            data: {
              heading: block.data.heading,
              body: "当院では、患者さま一人ひとりの生活に寄り添った診療を心がけています。",
              cards: [1, 2, 3, 4].map((n) => ({
                heading: `${block.data.heading}の項目${n}`,
                body: "説明のテキストがここに入ります。丁寧な診察と分かりやすい説明を大切にしています。",
                image: img(`${block.id}${n}`),
              })),
            },
          };
        case "hours":
          return {
            ...block,
            data: {
              heading: "診療時間",
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
            data: {
              heading: "アクセス",
              address: "東京都渋谷区桜丘町1-2-3 さくらビル2F",
              mapQuery: encodeURIComponent("東京都渋谷区桜丘町1-2-3"),
            },
          };
        case "news":
          return {
            ...block,
            data: {
              heading: "お知らせ",
              items: [
                { date: "2026.08.01", title: "夏季休診のお知らせ" },
                { date: "2026.07.10", title: "インフルエンザ予防接種の予約を開始しました" },
              ],
            },
          };
        case "staff":
          return {
            ...block,
            data: {
              heading: "スタッフ紹介",
              members: [
                { name: "山田 太郎", role: "院長", comment: "地域のかかりつけ医として、丁寧な診療を心がけています。", image: img("staff1") },
                { name: "佐藤 花子", role: "看護師長", comment: "安心して過ごしていただける環境づくりに努めています。", image: img("staff2") },
              ],
            },
          };
        case "pricing":
          return {
            ...block,
            data: {
              heading: "料金表",
              items: [
                { name: "初診料（3割負担）", price: "約1,000円", note: "検査により変動します" },
                { name: "インフルエンザ予防接種", price: "3,500円" },
              ],
            },
          };
        case "faq":
          return {
            ...block,
            data: {
              heading: "よくある質問",
              items: [
                { question: "予約は必要ですか？", answer: "予約なしでも受診いただけますが、お電話でのご予約をおすすめしています。" },
                { question: "駐車場はありますか？", answer: "提携駐車場をご利用いただけます。" },
              ],
            },
          };
        default:
          return block;
      }
    }),
  };

  const { previewUrl } = await renderSiteFiles(doc);
  return Response.redirect(new URL(previewUrl, "http://localhost:3000"), 302);
}
