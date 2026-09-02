/** Hearing sheet → generated clinic site.
 *
 * One OpenAI chat call turns the submitted `HearingSheet` into a `SiteTemplate` (copy, theme,
 * section order); a handful of OpenAI image calls fill the photo slots that the applicant did not
 * upload themselves; `renderBundle` writes the static bundle to `public/_generated/<slug>/`.
 *
 * This is an admin-triggered, synchronous operation — see `generateSiteAction` in
 * src/lib/contentActions.ts. It takes tens of seconds (mostly image generation). */

import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
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
  /** The normalised template the bundle was rendered from — persisted on the hearing row so the
   * site editor has a source of truth that survives the bundle dir being wiped. */
  template: SiteTemplate;
  imagesGenerated: number;
  imagesFromUploads: number;
  warnings: string[];
};

/** Reads the template.json a previous build left in the bundle dir. The hearing row's stored copy
 * is preferred by callers; this is the fallback when that is absent. */
export async function readStoredTemplate(slug: string): Promise<SiteTemplate | null> {
  try {
    const raw = await readFile(path.join(GENERATED_ROOT, slug, "template.json"), "utf8");
    return JSON.parse(raw) as SiteTemplate;
  } catch {
    return null;
  }
}

/** Renders `template` and writes the full bundle to public/_generated/<slug>/, replacing any
 * previous contents. Used by the generator and by the editor's save action (no OpenAI involved). */
export async function writeBundle(slug: string, template: SiteTemplate): Promise<void> {
  const files = renderBundle(template);
  const dir = path.join(GENERATED_ROOT, slug);
  await rm(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
}

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
    schedule: h.schedule ?? null,
    hours: h.hours || null,
    features: h.features || null,
    featureNames: h.featureNames ?? [],
    targetNames: h.targetNames ?? [],
    freeTextRequest: h.request || null,
    director: h.director
      ? { name: h.director.name || null, role: h.director.role || null, greeting: h.director.greeting || null }
      : null,
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

function heroPrompt(vibe: string): string {
  return `${IMAGE_BASE} ${vibe} トップページ用の横長の写真。明るい院内または受付まわりを広めに。人物は写さない。左側に文字を重ねる余白を残す。`;
}

function exteriorPrompt(vibe: string): string {
  return `${IMAGE_BASE} ${vibe} クリニックの建物外観（エントランスまわり、日中、通行人は写さない）。`;
}

function medicalPrompt(name: string, vibe: string): string {
  return `${IMAGE_BASE} ${vibe} 「${name}」の診療に関連する落ち着いた院内カット。人物や患部は写さない。`;
}

/** Fills one image slot: uploaded URL first, then OpenAI when storage is configured, else null.
 * Returns `{ src, generated }`; increments are done by the caller. */
async function fillSlot(
  slug: string,
  slot: string,
  pool: string[],
  prompt: string,
  size: ImageSize,
  allowAi: boolean,
  warnings: string[],
  label: string
): Promise<{ src: string | null; fromUpload: boolean; generated: boolean }> {
  if (pool.length) return { src: pool.shift()!, fromUpload: true, generated: false };
  if (!allowAi || !isStorageConfigured()) return { src: null, fromUpload: false, generated: false };
  try {
    const src = await generateAndUpload(slug, slot, prompt, size);
    return { src, fromUpload: false, generated: true };
  } catch (e) {
    warnings.push(`${label}の生成に失敗しました（プレースホルダを使用）: ${msg(e)}`);
    return { src: null, fromUpload: false, generated: false };
  }
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
  const template: SiteTemplate = normalizeTemplate(raw, {
    brandName: hearing.clinicName,
    department: hearing.department,
    hours: hearing.hours,
  });

  // Contact facts always come from the sheet when present (never let the model override them).
  if (hearing.phone) template.contact.phone = hearing.phone;
  if (hearing.address) template.contact.address = hearing.address;
  if (hearing.line) template.contact.reserveUrl = hearing.line;

  // 診療時間 is published verbatim from the applicant's structured input — no AI rewrite.
  if (hearing.schedule?.rows?.length) {
    const sch = template.sections.schedule;
    if (hearing.schedule.days?.length) sch.days = hearing.schedule.days;
    sch.rows = hearing.schedule.rows;
    if (hearing.schedule.notes?.length) sch.notes = hearing.schedule.notes;
  }

  // 院長紹介 — name/role are facts (verbatim); the greeting message is used as-is when provided.
  if (hearing.director) {
    const g = template.sections.greeting;
    if (hearing.director.name) g.doctorName = hearing.director.name;
    if (hearing.director.role) g.doctorRole = hearing.director.role;
    const paras = hearing.director.greeting
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (paras.length) g.message = paras;
  }

  // 2. photos — prefer the applicant's own uploads, then OpenAI, else leave the placeholder SVG.
  const vibe =
    [hearing.department, hearing.features, ...(hearing.targetNames ?? [])]
      .filter(Boolean)
      .join("、") || "地域のかかりつけクリニック";

  // interior/atmosphere → gallery + hero + medical cards. exterior → access exterior + hero backup.
  const uploadPool = [
    ...(hearing.uploadedImages?.interior ?? []),
    ...(hearing.uploadedImages?.atmosphere ?? []),
  ];
  const exteriorPool = [...(hearing.uploadedImages?.exterior ?? [])];
  let imagesFromUploads = 0;
  let imagesGenerated = 0;

  // 2a. greeting portrait — 院長紹介 photo first, then (legacy) staff photo, then AI, then placeholder
  const directorPhoto = hearing.director?.photoUrl || hearing.staffMembers?.find((s) => s.photoUrl)?.photoUrl;
  if (directorPhoto) {
    template.sections.greeting.image.src = directorPhoto;
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

  // 2c. hero background photo — uploaded > interior pool > AI > decorative art (null)
  if (hearing.heroImageUrl) {
    template.sections.hero.image.src = hearing.heroImageUrl;
    imagesFromUploads++;
  } else {
    const r = await fillSlot(
      hearing.slug,
      "hero",
      uploadPool,
      heroPrompt(vibe),
      "1536x1024",
      true,
      warnings,
      "トップ画像"
    );
    if (r.src) template.sections.hero.image.src = r.src;
    if (r.fromUpload) imagesFromUploads++;
    if (r.generated) imagesGenerated++;
  }

  // 2d. access exterior photo — exterior upload > AI > none
  {
    const r = await fillSlot(
      hearing.slug,
      "exterior",
      exteriorPool,
      exteriorPrompt(vibe),
      "1536x1024",
      true,
      warnings,
      "外観写真"
    );
    if (r.src) template.sections.access.exteriorPhoto.src = r.src;
    if (r.fromUpload) imagesFromUploads++;
    if (r.generated) imagesGenerated++;
  }

  // 2e. medical card photos — remaining uploads first, then AI for at most the first 2 cards
  const MEDICAL_IMG_AI_MAX = 2;
  let medicalAiUsed = 0;
  for (const item of template.sections.medical.items) {
    const r = await fillSlot(
      hearing.slug,
      `medical-${medicalAiUsed + 1}`,
      uploadPool,
      medicalPrompt(item.ja, vibe),
      "1536x1024",
      medicalAiUsed < MEDICAL_IMG_AI_MAX,
      warnings,
      `診療案内「${item.ja}」の写真`
    );
    if (r.src) item.image.src = r.src;
    if (r.fromUpload) imagesFromUploads++;
    if (r.generated) {
      imagesGenerated++;
      medicalAiUsed++;
    }
  }

  if (!isStorageConfigured()) {
    warnings.push(
      "Supabase Storage が未設定のため画像は生成せず、プレースホルダのままです（SUPABASE_URL / SUPABASE_ANON_KEY）。"
    );
  }

  // 3. render + write
  await writeBundle(hearing.slug, template);

  return {
    slug: hearing.slug,
    url: `/api/generated/${hearing.slug}/`,
    template,
    imagesGenerated,
    imagesFromUploads,
    warnings,
  };
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// --- editor helpers (no bundle write; caller decides when to save) ----------

const SECTION_SYSTEM = `あなたは日本の個人クリニックのホームページのコピーライターです。
指定された1つのセクションの内容だけを、より自然で具体的な日本語に書き直し、そのセクションの
JSONオブジェクトだけを返してください（前後の説明・マークダウンは書かない）。キー構成は入力と
同じに保つこと。事実の創作はしない（装置名・資格・症例数・存在しない予約手段など）。`;

/** Rewrites one section's copy via OpenAI and returns a new, fully-normalised template. The layout
 * and every other section are preserved. Nothing is written to disk. */
export async function regenerateSectionText(
  hearing: HearingSheet,
  template: SiteTemplate,
  sectionId: string
): Promise<SiteTemplate> {
  if (!isOpenAiConfigured()) {
    throw new Error("OpenAIが設定されていません（OPENAI_API_KEY）。");
  }
  const current = (template.sections as Record<string, unknown>)[sectionId];
  if (current === undefined) throw new Error(`不明なセクションです: ${sectionId}`);

  const context = {
    clinicName: hearing.clinicName,
    department: hearing.department || null,
    features: hearing.features || null,
    targetNames: hearing.targetNames ?? [],
    freeTextRequest: hearing.request || null,
  };
  const revised = await openaiJSON<Record<string, unknown>>({
    system: SECTION_SYSTEM,
    user: `クリニック情報:\n${JSON.stringify(context, null, 2)}\n\n書き直すセクション「${sectionId}」の現在の内容:\n${JSON.stringify(
      current,
      null,
      2
    )}`,
    temperature: 0.8,
    maxTokens: 1500,
  });

  const merged: SiteTemplate = {
    ...template,
    sections: {
      ...template.sections,
      [sectionId]: { ...(current as object), ...revised },
    } as SiteTemplate["sections"],
  };
  return normalizeTemplate(merged, {
    brandName: hearing.clinicName,
    department: hearing.department,
    hours: hearing.hours,
    trustLayout: true,
  });
}

/** Generates one photo via OpenAI, uploads it to Supabase Storage, and returns its public URL. */
export async function generateOneImage(
  slug: string,
  kind: "portrait" | "interior" | "exterior",
  hint: string
): Promise<string> {
  if (!isOpenAiConfigured()) throw new Error("OpenAIが設定されていません（OPENAI_API_KEY）。");
  if (!isStorageConfigured()) {
    throw new Error("Supabase Storage が未設定のため画像を保存できません（SUPABASE_URL / SUPABASE_ANON_KEY）。");
  }
  const prompt =
    kind === "portrait"
      ? doctorPrompt(hint || "医師", hint)
      : `${IMAGE_BASE} ${hint}`;
  const size: ImageSize = kind === "portrait" ? "1024x1536" : "1536x1024";
  return generateAndUpload(slug, kind, prompt, size);
}
