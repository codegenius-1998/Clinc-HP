/** Hearing sheet → generated clinic site.
 *
 * One OpenAI chat call turns the submitted `HearingSheet` into a `SiteTemplate` (copy, theme,
 * section order); a handful of OpenAI image calls fill the photo slots that the applicant did not
 * upload themselves; `renderBundle` writes the static bundle to `public/_generated/<slug>/`.
 *
 * This is an admin-triggered, synchronous operation — see `generateSiteAction` in
 * src/lib/contentActions.ts. It takes tens of seconds (mostly image generation). */

import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { HearingSheet } from "./hearing";
import { openaiJSON, openaiImage, isOpenAiConfigured, type ImageSize } from "./openai";
import { isStorageConfigured, uploadObject } from "./supabaseStorage";
import { normalizeTemplate } from "./generatedSite/normalize";
import { renderBundle } from "./generatedSite/render";
import type { SiteTemplate } from "./generatedSite/types";

export const GENERATED_ROOT = path.join(process.cwd(), "public", "_generated");

export type BuildResult = {
  slug: string;
  /** App path the bundle is served under (see src/app/api/generated/[slug]/[[...path]]/route.ts). */
  url: string;
  imagesGenerated: number;
  imagesFromUploads: number;
  warnings: string[];
};

// --- prompt ----------------------------------------------------------------

const SYSTEM_PROMPT = `あなたは日本の個人クリニックのホームページを作る、医療系に強いWebコピーライター兼インフォメーションアーキテクトです。
与えられたヒアリングシート（JSON）をもとに、1ページのクリニックサイトの内容を表す **JSONオブジェクトだけ** を出力してください。前置き・説明・マークダウンは一切書かないこと。

## 厳守事項
- すべての表示文字列は自然な日本語。敬体。医療広告として不適切な断定・効果保証は書かない。
- ヒアリングシートに無い固有の事実（装置名・症例数・資格・経歴・受賞）は創作しない。一般的な診療内容の範囲で自然に補う。
- 電話・住所・予約URLがシートに無ければ、それぞれ "00-0000-0000" / "〒000-0000　○○県○○市○○町 0-0-0" / "https://lin.ee/0000000" のダミーを使う。
- \`layout\` と \`nav\` と \`sections.footer.nav\` は、実際に内容を入れたセクションだけを、同じ順序・同じidで参照して整合させる。
- \`sections.hero.headline\` は1〜2行の配列。強調したい語句は 半角アスタリスクで *囲む*（例: "*お気軽に*ご相談ください"）。
- \`sections.medical.items[].icon\` は必ず次のいずれか: skin, child, sparkle, care, tooth, eye, bone, heart, allergy, general。
- 画像スロット（\`image\`）は必ず \`{ "src": null, "alt": "説明" }\` の形にする（srcは常にnull。写真は後工程で用意する）。
- 色はクリニックの診療科・雰囲気・ターゲットに合わせて選ぶ。淡く清潔感のある配色。すべて #rrggbb。
- \`theme.fonts.googleHref\` は選んだ2書体の有効な https://fonts.googleapis.com/css2?family=... URL。日本語対応書体を選ぶ。

## 出力する JSON の形（値は例。同じキー構成で返すこと）
{
  "meta": { "title": "医院名｜地域・診療科", "description": "120字程度の説明" },
  "theme": {
    "colors": { "primary":"#7aa9d8","primaryDeep":"#4f7aa6","accent":"#dd93b0","tint":"#f8f3ea","paper":"#fffdf8","ink":"#4a453f","inkSoft":"#8b8579","line":"#ece3d2" },
    "washes": { "pink":"#f2cdd6","blue":"#c9dcee","yellow":"#f3e7b6","peach":"#f4d6c0","mint":"#d0e4d8" },
    "botanicalStroke": "#c9bda4",
    "fonts": { "googleHref":"https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap",
               "heading":"\\"Klee One\\", \\"Hiragino Maru Gothic ProN\\", \\"Yu Gothic\\", serif",
               "body":"\\"Zen Kaku Gothic New\\", \\"Hiragino Sans\\", \\"Yu Gothic\\", sans-serif",
               "headingTracking":"0.09em" }
  },
  "brand": { "name":"医院名", "nameEn":"Romaji Clinic Name", "logo": null },
  "contact": { "phone":"00-0000-0000","phoneCaption":"お電話でのお問い合わせ","reserveUrl":"https://lin.ee/0000000","reserveLabel":"LINEで予約","address":"〒000-0000　…" },
  "layout": [ {"id":"hero","kind":"hero"}, {"id":"greeting","kind":"greeting"}, {"id":"medical","kind":"services"}, {"id":"philosophy","kind":"philosophy"}, {"id":"gallery","kind":"gallery"}, {"id":"schedule","kind":"schedule"}, {"id":"fees","kind":"fees"}, {"id":"flow","kind":"flow"}, {"id":"faq","kind":"faq"}, {"id":"news","kind":"news"}, {"id":"access","kind":"access"}, {"id":"contact","kind":"cta"} ],
  "nav": [ {"href":"#hero","label":"ホーム"}, {"href":"#greeting","label":"当院について"}, {"href":"#medical","label":"診療案内"}, {"href":"#fees","label":"料金"}, {"href":"#schedule","label":"診療時間"}, {"href":"#faq","label":"よくあるご質問"}, {"href":"#access","label":"アクセス"} ],
  "sections": {
    "hero": { "image":{"src":null,"alt":""}, "tagline":"短いキャッチ", "headline":["肌のこと、","*気軽に*ご相談ください"], "sub":"2〜3文の説明", "bubbles":["駅前 徒歩1分","土日も診療","女性医師が在籍","小児にも対応","予約制","バリアフリー"] },
    "greeting": { "heading":{"ja":"当院について","en":"About"}, "image":{"src":null,"alt":"院長 氏名"}, "doctorName":"氏名（シートにあれば）","doctorRole":"院長","message":["段落1","段落2"] },
    "medical": { "heading":{"ja":"診療案内","en":"Medical"}, "intro":"1〜2文", "items":[ {"icon":"skin","ja":"一般皮膚科","en":"Dermatology","lead":"説明"}, {"icon":"child","ja":"小児皮膚科","en":"Pediatric","lead":"説明"} ], "conditions":["症状1","症状2","症状3","症状4","症状5","症状6"] },
    "philosophy": { "heading":{"ja":"当院の想い","en":"Our thoughts"}, "lead":"短い一節", "body":["段落1","段落2"] },
    "gallery": { "heading":{"ja":"院内のようす","en":"Our clinic"}, "intro":"1文", "items":[ {"image":{"src":null,"alt":"待合スペース"},"caption":"待合スペース"}, {"image":{"src":null,"alt":"受付"},"caption":"受付"}, {"image":{"src":null,"alt":"診察室"},"caption":"診察室"} ] },
    "schedule": { "heading":{"ja":"診療時間","en":"Hours"}, "cornerLabel":"受付時間", "days":["月","火","水","木","金","土","日"], "rows":[ {"label":"9:00 - 13:00","marks":["●","●","●","／","●","▲","▲"]}, {"label":"14:30 - 18:00","marks":["●","●","●","／","●","／","／"]} ], "notes":["休診日 … …"] },
    "fees": { "heading":{"ja":"料金の目安","en":"Fees"}, "disclaimer":"注意書き", "groups":[ {"group":"分類","items":[ {"name":"項目","price":"¥2,000〜","note":"任意"} ]} ] },
    "flow": { "heading":{"ja":"受診の流れ","en":"Flow"}, "steps":[ {"no":"01","title":"ご予約・ご来院","body":"説明"}, {"no":"02","title":"問診・診察","body":"説明"}, {"no":"03","title":"説明","body":"説明"} ] },
    "faq": { "heading":{"ja":"よくあるご質問","en":"FAQ"}, "items":[ {"q":"質問","a":"回答"} ] },
    "news": { "heading":{"ja":"お知らせ","en":"News"}, "items":[ {"date":"2026.08.20","title":"見出し"} ] },
    "access": { "heading":{"ja":"交通案内","en":"Access"}, "image":{"src":null,"alt":"周辺地図"}, "points":["最寄駅から徒歩…","エレベーターあり"], "info":[ {"term":"診療時間","lines":["月〜金 9:00–18:00"]}, {"term":"休診日","lines":["日曜・祝日"]} ] },
    "contact": { "heading":{"ja":"ご予約・お問い合わせ","en":"Contact"}, "lead":"1〜2文", "reserveLabel":"LINEで予約する", "phoneCaption":"お電話", "note":"受付時間 … " },
    "footer": { "nav":[ {"href":"#greeting","label":"当院について"} ], "copyright":"© 医院名" }
  }
}

内容量の目安: medical.items 3〜5 / medical.conditions 6〜16 / faq.items 4〜6 / flow.steps 3〜5 / news.items 3〜4（2026年の直近の日付）/ fees.groups 2〜3。`;

function hearingToPromptInput(h: HearingSheet): string {
  const payload = {
    clinicName: h.clinicName,
    address: h.address || null,
    phone: h.phone || null,
    lineOrReserveUrl: h.line || null,
    department: h.department || null,
    serviceNames: h.serviceNames ?? [],
    hours: h.hours || null,
    features: h.features || null,
    featureNames: h.featureNames ?? [],
    targetNames: h.targetNames ?? [],
    freeTextRequest: h.request || null,
    staffMembers: (h.staffMembers ?? []).map((s) => ({
      name: s.name,
      role: s.role || null,
      comment: s.comment || null,
    })),
    priceItems: h.priceItems ?? [],
    faqs: h.faqs ?? [],
    news: h.news ?? [],
  };
  return `次のヒアリングシートからクリニックサイトのJSONを作ってください:\n\n${JSON.stringify(
    payload,
    null,
    2
  )}`;
}

// --- images --------------------------------------------------------------

const IMAGE_BASE =
  "写真はフォトリアル、日本の個人クリニック、清潔で明るく穏やかな雰囲気、自然光、文字・ロゴ・透かしは入れない。";

function galleryPrompt(caption: string, vibe: string): string {
  return `${IMAGE_BASE} ${vibe} 院内の「${caption}」の様子。人物は写さないか、写っても後ろ姿でぼかす。`;
}

function doctorPrompt(role: string, vibe: string): string {
  return `${IMAGE_BASE} ${vibe} 白衣を着た日本人の${role || "医師"}のポートレート（上半身、やわらかい背景、穏やかな表情）。`;
}

async function generateAndUpload(
  slug: string,
  slot: string,
  prompt: string,
  size: ImageSize
): Promise<string> {
  const bytes = await openaiImage({ prompt, size });
  const key = `generated/${slug}/${slot}-${randomUUID()}.png`;
  return uploadObject(key, bytes, "image/png");
}

// --- main --------------------------------------------------------------

export async function buildSiteFromHearing(hearing: HearingSheet): Promise<BuildResult> {
  if (!isOpenAiConfigured()) {
    throw new Error("OpenAIが設定されていません（.env.local の OPENAI_API_KEY を確認してください）。");
  }

  const warnings: string[] = [];

  // 1. copy + structure
  const raw = await openaiJSON<unknown>({
    system: SYSTEM_PROMPT,
    user: hearingToPromptInput(hearing),
    temperature: 0.7,
    maxTokens: 4000,
  });
  const template: SiteTemplate = normalizeTemplate(raw, hearing.clinicName);

  // Contact facts always come from the sheet when present (never let the model override them).
  if (hearing.phone) template.contact.phone = hearing.phone;
  if (hearing.address) template.contact.address = hearing.address;
  if (hearing.line) template.contact.reserveUrl = hearing.line;

  // 2. photos — prefer the applicant's own uploads, then OpenAI, else leave the placeholder SVG.
  const vibe =
    [hearing.department, hearing.features, ...(hearing.targetNames ?? [])]
      .filter(Boolean)
      .join("、") || "地域のかかりつけクリニック";

  const uploadPool = [
    ...(hearing.uploadedImages?.interior ?? []),
    ...(hearing.uploadedImages?.atmosphere ?? []),
    ...(hearing.uploadedImages?.exterior ?? []),
  ];
  let imagesFromUploads = 0;
  let imagesGenerated = 0;

  // 2a. greeting portrait
  const staffPhoto = hearing.staffMembers?.find((s) => s.photoUrl)?.photoUrl;
  if (staffPhoto) {
    template.sections.greeting.image.src = staffPhoto;
    imagesFromUploads++;
  } else if (isStorageConfigured()) {
    try {
      template.sections.greeting.image.src = await generateAndUpload(
        hearing.slug,
        "doctor",
        doctorPrompt(template.sections.greeting.doctorRole, vibe),
        "1024x1536"
      );
      imagesGenerated++;
    } catch (e) {
      warnings.push(`院長写真の生成に失敗しました（プレースホルダを使用）: ${msg(e)}`);
    }
  }

  // 2b. gallery interiors
  for (const item of template.sections.gallery.items) {
    if (uploadPool.length) {
      item.image.src = uploadPool.shift()!;
      imagesFromUploads++;
      continue;
    }
    if (!isStorageConfigured()) break;
    try {
      item.image.src = await generateAndUpload(
        hearing.slug,
        `room-${imagesGenerated + 1}`,
        galleryPrompt(item.caption, vibe),
        "1536x1024"
      );
      imagesGenerated++;
    } catch (e) {
      warnings.push(`院内写真「${item.caption}」の生成に失敗しました（プレースホルダを使用）: ${msg(e)}`);
    }
  }

  if (!isStorageConfigured()) {
    warnings.push(
      "Supabase Storage が未設定のため画像は生成せず、プレースホルダのままです（SUPABASE_URL / SUPABASE_ANON_KEY）。"
    );
  }

  // 3. render + write
  const files = renderBundle(template);
  const dir = path.join(GENERATED_ROOT, hearing.slug);
  await rm(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }

  return {
    slug: hearing.slug,
    url: `/api/generated/${hearing.slug}/`,
    imagesGenerated,
    imagesFromUploads,
    warnings,
  };
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
