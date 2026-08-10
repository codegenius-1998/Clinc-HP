"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { createHearingAction, type HearingFormState } from "@/lib/actions";
import type { DesignPreset, ColorTheme } from "@/lib/designPresets";
import type { SiteSpecSection } from "@/lib/siteSpec";
import { IMAGE_CATEGORIES, type ImageCategoryKey } from "@/lib/imageCategories";
import { SectionOrderEditor, initialSectionRows, type SectionRow } from "./SectionOrderEditor";

type PickedImage = { kind: "file"; file: File; previewUrl: string } | { kind: "url"; url: string };

function previewSrc(img: PickedImage): string {
  return img.kind === "file" ? img.previewUrl : img.url;
}

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none";

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8";

const initialState: HearingFormState = { error: null };

const DEFAULT_CLINIC_NAME = "西にっぽり内科消化器クリニック";
const DEFAULT_DIRECTOR_NAME = "森川 麗（もりかわ れい）";
const DEFAULT_ADDRESS = "〒116-0013 東京都荒川区西日暮里5-11-8 三共セントラルプラザビル7F";
const DEFAULT_PHONE = "03-3805-8181";
const DEFAULT_LINE = "@abcabc";
const DEFAULT_DEPARTMENT = "内科・内視鏡内科・消化器内科・肝臓内科";
const DEFAULT_HOURS = [
  "月・火・木・金：9:30〜12:30 / 14:30〜18:30",
  "水：9:30〜12:30",
  "土：9:30〜12:30 / 14:00〜17:00",
  "日・祝：休診",
].join("\n");
const DEFAULT_FEATURES = [
  "一般内科・生活習慣病から消化器疾患、肝臓疾患まで幅広く診療",
  "胃・大腸内視鏡検査に対応",
  "土曜日・日曜日も内視鏡検査に対応",
  "西日暮里駅から徒歩2〜3分程度でアクセスしやすい",
  "Web予約・LINE予約に対応",
  "女性院長による診療で、特にお腹の症状や排便の悩みなど、相談しづらい症状にも配慮",
  "健康診断・がん検診、人間ドック、予防接種、禁煙外来などにも対応",
  "「患者様一人ひとりの不安に寄り添い、安心して通えるクリニック」を目指している",
].join("\n");
const DEFAULT_REQUEST = [
  "内視鏡検査に強いクリニック",
  "女性院長による安心・丁寧な診療",
  "土曜日・日曜日にも検査可能",
  "西日暮里駅から徒歩圏内",
  "LINE・Webから簡単に予約可能",
  "一般内科から消化器・肝臓まで幅広く対応",
].join("\n");

const DEFAULT_CATEGORY_IMAGE_URLS: Partial<Record<ImageCategoryKey, string[]>> = {
  exterior: [
    "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/clinc-hp/exterior/504a8b73-942f-482a-83e9-cfc62afc932f.jpg",
  ],
  interior: [
    "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/uploads/106a548b-2392-403e-b07f-481bcc16f6bb.jpg",
    "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/uploads/c18652b8-e2b6-4b4e-bdd9-688089a3fa24.jpg",
  ],
  atmosphere: [
    "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/uploads/2650b010-cf0f-48d9-aa49-0747d128b67a.jpg",
    "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/uploads/54b54cfd-e916-4370-aef2-d06c37e0fc6d.jpg",
  ],
};

function defaultImagesByCategory(): Record<ImageCategoryKey, PickedImage[]> {
  const entries = IMAGE_CATEGORIES.map(
    (c) =>
      [c.key, (DEFAULT_CATEGORY_IMAGE_URLS[c.key] ?? []).map((url): PickedImage => ({ kind: "url", url }))] as const
  );
  return Object.fromEntries(entries) as Record<ImageCategoryKey, PickedImage[]>;
}

type StaffMemberInput = { name: string; comment: string; role: string; photo: PickedImage | null; photoUrlDraft: string };
type FaqInput = { question: string; answer: string };
type NewsInput = { date: string; title: string };
type PriceItemInput = { name: string; price: string; note: string };

const STAFF_ROLE_OPTIONS = ["院長", "副院長", "医師", "看護師", "薬剤師", "受付・事務", "スタッフ"];

const DEFAULT_STAFF_MEMBERS: StaffMemberInput[] = [
  {
    name: "松本昭則",
    role: "院長",
    comment:
      "当医院は小児から成人までの歯並びや噛み合わせの治療を行う矯正歯科治療専門のクリニックです。『患者さんにとってBestな治療』をモットーに矯正歯科治療を行い、地域医療に密着した医院を目指していきます。特に、患者さんに納得した治療を受けていただくために、十分なカウンセリングを行い、日本矯正歯科学会認定医による矯正歯科に必要な検査やそれぞれの患者さんにあった治療方法を提案させて頂きます。",
    photo: {
      kind: "url",
      url: "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/uploads/5ba0fdf6-e1e9-4fc2-a8a5-c93b7b378550.jpg",
    },
    photoUrlDraft: "",
  },
  {
    name: "松本高明",
    role: "医師",
    comment:
      "大学入学と共に姫路を離れ、関東で歯科大学の学生として、卒業後は歯科矯正学講座の医局員または大学院生として治療・研究・勉学に勤しみ約14年、無事姫路に帰ってくることが出来ました。",
    photo: {
      kind: "url",
      url: "https://dsrycnvxrnuwdkwvedhj.supabase.co/storage/v1/object/public/site-images/uploads/9c1fa80e-c6b8-4c7d-ad9e-97e5af0af3a0.jpg",
    },
    photoUrlDraft: "",
  },
];

const DEFAULT_FAQS: FaqInput[] = [
  {
    question: "健康保険証は使えますか？",
    answer:
      "下肢静脈瘤、ハイドロリリース治療は健康保険が適用されます。またへバーデン結節、足底腱膜炎やテニス肘などの動注治療、またPRP治療は保険適応外の治療となります。費用については料金表のページをご覧ください。",
  },
  {
    question: "車で受診できますか？",
    answer:
      "クリニックから歩いて30秒程度のところに提携の大型コインパーキングが２カ所ございます。無料チケットをご用意しております。お帰りの際にお申し出ください。具体的な場所についてはアクセスのページをご覧ください。また当院の前にも1台分の駐車スペースはございます。",
  },
  {
    question: "治療後に車の運転はできますか？",
    answer:
      "当クリニックでは静脈麻酔は使用していないので、手術日であってもお車の運転も安全にすることができます。手術日であってもそのままご自分の運転でお帰りいただけます。また駐車場も当クリニックの駐車場（徒歩30秒）をご利用頂ければ無料チケットを用意しております。お帰りの際にお申し出ください。下肢静脈瘤の治療についてはこちらをご覧ください。",
  },
  {
    question: "初診時はどのような服装で行けばいいですか？",
    answer: "できるだけスカートやゆるめのズボンでお越し頂けると幸いですが、着替えも用意しておりますので、安心して受診してください。",
  },
];

const DEFAULT_NEWS: NewsInput[] = [];
const DEFAULT_PRICE_ITEMS: PriceItemInput[] = [];

const STEP_LABELS = ["セクション構成・カラー", "セクション情報を入力", "デザイン選択", "作成"];

/** section ids whose AI-authored copy draws on the shared "医院の特徴" textarea — asked once (in the
 * step-2 sub-wizard's "features" stop) rather than once per section. Keep in sync with
 * hp-templates/SITE_SPEC.json's `content.drivenBy`. */
const FEATURES_DRIVEN_SECTIONS = ["department", "greeting", "features", "facility"];
/** Sections with no input of their own — their content comes entirely from the shared "features" note
 * or from fields already collected in the "basic"/"photos" stops — so they're skipped as their own
 * stop in the step-2 sub-wizard (nothing to ask twice). */
const NO_DEDICATED_INPUT_SECTIONS = new Set(["facility", "contact"]);

type ContentStep = { id: string; title: string };

export function HearingSheetForm({
  presets,
  colors,
  sections,
}: {
  presets: DesignPreset[];
  colors: ColorTheme[];
  sections: SiteSpecSection[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(presets[0]?.id ?? "");
  const [colorScheme, setColorScheme] = useState(colors[0]?.id ?? "");
  const [clinicName, setClinicName] = useState(DEFAULT_CLINIC_NAME);
  const [sectionRows, setSectionRows] = useState<SectionRow[]>(() => initialSectionRows(sections));
  const [contentStepIndex, setContentStepIndex] = useState(0);
  const [state, formAction, pending] = useActionState(createHearingAction, initialState);
  const [imagesByCategory, setImagesByCategory] = useState<Record<ImageCategoryKey, PickedImage[]>>(defaultImagesByCategory);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMemberInput[]>(DEFAULT_STAFF_MEMBERS);
  const [faqs, setFaqs] = useState<FaqInput[]>(DEFAULT_FAQS);
  const [news, setNews] = useState<NewsInput[]>(DEFAULT_NEWS);
  const [priceItems, setPriceItems] = useState<PriceItemInput[]>(DEFAULT_PRICE_ITEMS);
  const [categoryUrlDraft, setCategoryUrlDraft] = useState<Record<ImageCategoryKey, string>>(
    () => Object.fromEntries(IMAGE_CATEGORIES.map((c) => [c.key, ""])) as Record<ImageCategoryKey, string>
  );

  const selectedPreset = presets.find((p) => p.id === templateId) ?? presets[0];
  const busy = uploading || pending;

  function isVisible(id: string): boolean {
    return sectionRows.find((r) => r.id === id)?.visible ?? true;
  }

  const showFeaturesField = FEATURES_DRIVEN_SECTIONS.some(isVisible);
  const showPhotosStep = ["department", "greeting", "facility"].some(isVisible);

  // The step-2 sub-wizard: one stop per visible section (in the order chosen in step 1), plus a
  // handful of fixed stops for information that isn't tied to a single section (basic contact info,
  // the shared "features" note, photos, and a closing free-text request). Recomputed from
  // `sectionRows` rather than stored separately, so toggling a section in step 1 can never leave a
  // stale stop behind.
  const contentSteps = useMemo<ContentStep[]>(() => {
    const steps: ContentStep[] = [{ id: "basic", title: "基本情報" }];
    if (showFeaturesField) steps.push({ id: "features", title: "医院の特徴" });
    for (const row of sectionRows) {
      if (!row.visible || NO_DEDICATED_INPUT_SECTIONS.has(row.id) || row.id === "features") continue;
      if (["department", "greeting", "hours", "access", "news", "staff", "faq", "pricing"].includes(row.id)) {
        steps.push({ id: row.id, title: row.label });
      }
    }
    if (showPhotosStep) steps.push({ id: "photos", title: "写真" });
    steps.push({ id: "request", title: "ご要望" });
    return steps;
  }, [sectionRows, showFeaturesField, showPhotosStep]);

  const currentContentStepIndex = Math.min(contentStepIndex, contentSteps.length - 1);
  const currentContentStep = contentSteps[currentContentStepIndex];

  function goToStep(next: 1 | 2 | 3 | 4) {
    setStepError(null);
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectPreset(preset: DesignPreset) {
    setTemplateId(preset.id);
  }

  function goToContentStep(index: number) {
    setStepError(null);
    setContentStepIndex(index);
    setStep(2);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleContentNext() {
    if (currentContentStep.id === "basic" && !clinicName.trim()) {
      setStepError("クリニック名を入力してください。");
      return;
    }
    if (currentContentStepIndex < contentSteps.length - 1) {
      goToContentStep(currentContentStepIndex + 1);
    } else {
      goToStep(3);
    }
  }

  function handleContentBack() {
    if (currentContentStepIndex > 0) {
      goToContentStep(currentContentStepIndex - 1);
    } else {
      goToStep(1);
    }
  }

  function handleImagesSelected(category: ImageCategoryKey, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const picked: PickedImage[] = Array.from(fileList).map((file) => ({
      kind: "file",
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImagesByCategory((prev) => ({ ...prev, [category]: [...prev[category], ...picked] }));
  }

  function updateCategoryUrlDraft(category: ImageCategoryKey, value: string) {
    setCategoryUrlDraft((prev) => ({ ...prev, [category]: value }));
  }

  function registerCategoryUrl(category: ImageCategoryKey) {
    const url = categoryUrlDraft[category].trim();
    if (!url) return;
    setImagesByCategory((prev) => ({ ...prev, [category]: [...prev[category], { kind: "url", url }] }));
    setCategoryUrlDraft((prev) => ({ ...prev, [category]: "" }));
  }

  function removeImage(category: ImageCategoryKey, index: number) {
    setImagesByCategory((prev) => {
      const removed = prev[category][index];
      if (removed?.kind === "file") URL.revokeObjectURL(removed.previewUrl);
      return { ...prev, [category]: prev[category].filter((_, i) => i !== index) };
    });
  }

  function addStaffMember() {
    setStaffMembers((prev) => [...prev, { name: "", comment: "", role: "", photo: null, photoUrlDraft: "" }]);
  }

  function updateStaffMember(index: number, field: "name" | "comment" | "role", value: string) {
    setStaffMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  function removeStaffMember(index: number) {
    setStaffMembers((prev) => {
      const removed = prev[index];
      if (removed?.photo?.kind === "file") URL.revokeObjectURL(removed.photo.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function setStaffPhoto(index: number, file: File | null) {
    setStaffMembers((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        if (m.photo?.kind === "file") URL.revokeObjectURL(m.photo.previewUrl);
        return { ...m, photo: file ? { kind: "file", file, previewUrl: URL.createObjectURL(file) } : null };
      })
    );
  }

  function updateStaffPhotoUrlDraft(index: number, value: string) {
    setStaffMembers((prev) => prev.map((m, i) => (i === index ? { ...m, photoUrlDraft: value } : m)));
  }

  function registerStaffPhotoUrl(index: number) {
    setStaffMembers((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        const url = m.photoUrlDraft.trim();
        if (!url) return m;
        if (m.photo?.kind === "file") URL.revokeObjectURL(m.photo.previewUrl);
        return { ...m, photo: { kind: "url", url }, photoUrlDraft: "" };
      })
    );
  }

  function addFaq() {
    setFaqs((prev) => [...prev, { question: "", answer: "" }]);
  }

  function updateFaq(index: number, field: keyof FaqInput, value: string) {
    setFaqs((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function removeFaq(index: number) {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  }

  function addNewsItem() {
    setNews((prev) => [...prev, { date: "", title: "" }]);
  }

  function updateNewsItem(index: number, field: keyof NewsInput, value: string) {
    setNews((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value } : n)));
  }

  function removeNewsItem(index: number) {
    setNews((prev) => prev.filter((_, i) => i !== index));
  }

  function addPriceItem() {
    setPriceItems((prev) => [...prev, { name: "", price: "", note: "" }]);
  }

  function updatePriceItem(index: number, field: keyof PriceItemInput, value: string) {
    setPriceItems((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function removePriceItem(index: number) {
    setPriceItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadOne(category: string, file: File): Promise<string> {
    const uploadForm = new FormData();
    uploadForm.append("category", category);
    uploadForm.append("files", file);
    const res = await fetch("/api/uploads", { method: "POST", body: uploadForm });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "画像のアップロードに失敗しました。");
    }
    return (data.urls as string[])[0];
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setUploadError(null);

    // URL-registered images need no Storage upload — attach them directly.
    for (const category of IMAGE_CATEGORIES) {
      for (const img of imagesByCategory[category.key]) {
        if (img.kind === "url") formData.append(`imageUrls_${category.key}`, img.url);
      }
    }

    const categoriesNeedingUpload = IMAGE_CATEGORIES.filter((c) =>
      imagesByCategory[c.key].some((img) => img.kind === "file")
    );
    const anyStaffFileUpload = staffMembers.some((m) => m.photo?.kind === "file");

    if (categoriesNeedingUpload.length > 0 || anyStaffFileUpload) {
      setUploading(true);
      try {
        for (const category of categoriesNeedingUpload) {
          const files = imagesByCategory[category.key].filter(
            (img): img is Extract<PickedImage, { kind: "file" }> => img.kind === "file"
          );
          const uploadForm = new FormData();
          uploadForm.append("category", category.key);
          files.forEach(({ file }) => uploadForm.append("files", file));

          const res = await fetch("/api/uploads", { method: "POST", body: uploadForm });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? "画像のアップロードに失敗しました。");
          }
          (data.urls as string[]).forEach((url) => formData.append(`imageUrls_${category.key}`, url));
        }

        // One staffPhotoUrl per staff row, in order, so the server action can zip it back up against
        // staffName/staffComment/staffRole by index.
        for (const member of staffMembers) {
          if (member.photo?.kind === "file") {
            formData.append("staffPhotoUrl", await uploadOne("staff", member.photo.file));
          } else {
            formData.append("staffPhotoUrl", member.photo?.kind === "url" ? member.photo.url : "");
          }
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "画像のアップロードに失敗しました。");
        setUploading(false);
        return;
      }
      setUploading(false);
    } else {
      // Nothing needs uploading, but staffPhotoUrl still needs one entry per row (URL-registered
      // photo, or empty) to keep index alignment with staffName/staffComment/staffRole.
      for (const member of staffMembers) {
        formData.append("staffPhotoUrl", member.photo?.kind === "url" ? member.photo.url : "");
      }
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  // Every top-level step wrapper stays mounted at all times (only `display` toggles) so every
  // field — including plain `defaultValue` inputs with no React state — keeps its current value when
  // the user moves between steps, and so `new FormData(form)` at final submit still picks up every
  // field regardless of which step happens to be showing.
  const stepStyle = (n: 1 | 2 | 3 | 4): React.CSSProperties => ({ display: step === n ? undefined : "none" });
  const contentStepStyle = (id: string): React.CSSProperties => ({
    display: step === 2 && currentContentStep?.id === id ? undefined : "none",
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                  step === n ? "bg-sky-600 text-white" : step > n ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-400"
                }`}
              >
                {i + 1}
              </span>
              <span className={step === n ? "font-medium text-slate-700" : ""}>{label}</span>
              {i < STEP_LABELS.length - 1 && <span className="mx-1 text-slate-300">→</span>}
            </li>
          );
        })}
      </ol>
      {step === 2 && (
        <p className="text-[12px] text-slate-400">
          セクション {currentContentStepIndex + 1} / {contentSteps.length}：{currentContentStep?.title}
        </p>
      )}

      {(uploadError || state.error) && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {uploadError ?? state.error}
        </p>
      )}
      {stepError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{stepError}</p>
      )}

      {uploading && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-700">
          写真をアップロードしています…
        </p>
      )}
      {pending && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-700">
          AIがページ内のテキストと画像（10〜20点ほど）を生成しています。数分かかることがあります…
        </p>
      )}

      {/* ステップ1: セクション構成・カラー */}
      <div className="space-y-6" style={stepStyle(1)}>
        <div className={cardClassName}>
          <SectionOrderEditor rows={sectionRows} onChange={setSectionRows} />
        </div>

        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">
            カラー
            <span className="ml-1 text-sky-500">*</span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">サイト全体の配色です。デザイン（雰囲気）は次の画面以降で選びます。</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {colors.map((theme) => (
              <li key={theme.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[13px] text-slate-700 transition-colors has-checked:border-sky-400 has-checked:bg-sky-50 has-checked:text-sky-700">
                  <input
                    type="radio"
                    name="colorScheme"
                    value={theme.id}
                    checked={colorScheme === theme.id}
                    onChange={() => setColorScheme(theme.id)}
                    className="h-3.5 w-3.5 text-sky-600 focus:ring-0"
                    required
                  />
                  <span
                    aria-hidden
                    className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: theme.tokens.primary }}
                  />
                  {theme.label}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => goToContentStep(0)}
          disabled={colors.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          次へ：セクション情報を入力
          <span aria-hidden>→</span>
        </button>
      </div>

      {/* ステップ2: セクション情報を入力（Section1 → Section2 → … と1つずつ） */}
      <div style={stepStyle(2)}>
        <div style={contentStepStyle("basic")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">基本情報</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">ヘッダーとお問い合わせに使う、どの構成でも必要な情報です。</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-medium text-slate-700">
                  クリニック名
                  <span className="ml-1 text-sky-500">*</span>
                </span>
                <input
                  type="text"
                  name="clinicName"
                  placeholder="〇〇クリニック"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  required
                  className={inputClassName}
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium text-slate-700">電話番号</span>
                <input type="tel" name="phone" placeholder="03-1234-5678" defaultValue={DEFAULT_PHONE} className={inputClassName} />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium text-slate-700">LINE</span>
                <input type="text" name="line" placeholder="@example" defaultValue={DEFAULT_LINE} className={inputClassName} />
              </label>
            </div>
          </div>
        </div>

        <div style={contentStepStyle("features")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">医院の特徴</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              診療科案内・ご挨拶・特徴・施設案内のセクションは、この内容をもとにAIが文章を作成します。
            </p>
            <textarea
              name="features"
              placeholder="例: 土日診療、キッズスペース完備、駅から徒歩3分"
              defaultValue={DEFAULT_FEATURES}
              rows={8}
              className={inputClassName}
            />
          </div>
        </div>

        <div style={contentStepStyle("department")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">診療科案内</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">診療科目を入力してください。</p>
            <label className="mt-4 block">
              <span className="text-[13px] font-medium text-slate-700">診療科</span>
              <input
                type="text"
                name="department"
                placeholder="内科・小児科"
                defaultValue={DEFAULT_DEPARTMENT}
                className={inputClassName}
              />
            </label>
          </div>
        </div>

        <div style={contentStepStyle("greeting")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">ご挨拶</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">院長名を入力してください。挨拶文はAIが作成します。</p>
            <label className="mt-4 block">
              <span className="text-[13px] font-medium text-slate-700">院長名</span>
              <input
                type="text"
                name="directorName"
                placeholder="山田 太郎"
                defaultValue={DEFAULT_DIRECTOR_NAME}
                className={inputClassName}
              />
            </label>
          </div>
        </div>

        <div style={contentStepStyle("hours")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">診療時間</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">記載の通りそのまま掲載します（AIによる書き換えはしません）。</p>
            <textarea
              name="hours"
              placeholder={"例:\n月〜金 9:00-13:00 / 15:00-19:00\n土 9:00-13:00\n日・祝 休診"}
              defaultValue={DEFAULT_HOURS}
              rows={4}
              className={inputClassName}
            />
          </div>
        </div>

        <div style={contentStepStyle("access")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">アクセス</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">住所を入力してください。地図はこの住所から自動生成します。</p>
            <label className="mt-4 block">
              <span className="text-[13px] font-medium text-slate-700">住所</span>
              <input type="text" name="address" placeholder="東京都〇〇区〇〇1-2-3" defaultValue={DEFAULT_ADDRESS} className={inputClassName} />
            </label>
          </div>
        </div>

        <div style={contentStepStyle("photos")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">写真（任意）</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              使いたい実際の写真をカテゴリごとにアップロードしてください。指定の無いカテゴリや不足分はAIが自動生成します。ロゴは常にAIが生成します。
            </p>
            <div className="mt-5 space-y-5">
              {IMAGE_CATEGORIES.map((category) => (
                <div key={category.key} className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
                  <label className="block">
                    <span className="text-[13px] font-medium text-slate-700">{category.label}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        handleImagesSelected(category.key, e.target.files);
                        e.target.value = "";
                      }}
                      className="mt-2 block w-full text-[13px] text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-[13px] file:text-white"
                    />
                  </label>

                  <div className="mt-2 flex gap-2">
                    <input
                      type="url"
                      placeholder="画像URLを入力して登録"
                      value={categoryUrlDraft[category.key]}
                      onChange={(e) => updateCategoryUrlDraft(category.key, e.target.value)}
                      className={`${inputClassName} mt-0`}
                    />
                    <button
                      type="button"
                      onClick={() => registerCategoryUrl(category.key)}
                      className="mt-0 shrink-0 rounded-lg border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
                    >
                      URLから登録
                    </button>
                  </div>

                  {imagesByCategory[category.key].length > 0 && (
                    <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                      {imagesByCategory[category.key].map((img, i) => (
                        <li
                          key={`${img.kind}-${previewSrc(img)}-${i}`}
                          className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewSrc(img)} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(category.key, i)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="削除"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={contentStepStyle("staff")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">スタッフ紹介（任意）</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              実在するスタッフがいる場合のみ入力してください。人数分だけカードが生成されます。未入力の場合、スタッフ紹介セクションは非表示になります。
            </p>

            {staffMembers.length > 0 && (
              <ul className="mt-4 space-y-4">
                {staffMembers.map((member, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">氏名</span>
                          <input
                            type="text"
                            name="staffName"
                            placeholder="山田 花子"
                            value={member.name}
                            onChange={(e) => updateStaffMember(i, "name", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">役割</span>
                          <select
                            name="staffRole"
                            value={member.role}
                            onChange={(e) => updateStaffMember(i, "role", e.target.value)}
                            className={inputClassName}
                          >
                            <option value="">未設定</option>
                            {STAFF_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-[12px] font-medium text-slate-700">コメント</span>
                          <input
                            type="text"
                            name="staffComment"
                            placeholder="簡単な自己紹介・担当業務など"
                            value={member.comment}
                            onChange={(e) => updateStaffMember(i, "comment", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-[12px] font-medium text-slate-700">写真（任意）</span>
                          <p className="text-[11px] text-slate-400">未指定の場合はAIが生成します。</p>
                          {member.photo ? (
                            <div className="mt-2 flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={previewSrc(member.photo)}
                                alt=""
                                className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setStaffPhoto(i, null)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"
                              >
                                写真を削除
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  setStaffPhoto(i, e.target.files?.[0] ?? null);
                                  e.target.value = "";
                                }}
                                className="mt-2 block w-full text-[13px] text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-[13px] file:text-white"
                              />
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="url"
                                  placeholder="画像URLを入力して登録"
                                  value={member.photoUrlDraft}
                                  onChange={(e) => updateStaffPhotoUrlDraft(i, e.target.value)}
                                  className={`${inputClassName} mt-0`}
                                />
                                <button
                                  type="button"
                                  onClick={() => registerStaffPhotoUrl(i)}
                                  className="mt-0 shrink-0 rounded-lg border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
                                >
                                  URLから登録
                                </button>
                              </div>
                            </>
                          )}
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStaffMember(i)}
                        className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50"
                        aria-label="このスタッフを削除"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={addStaffMember}
              className="mt-4 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
            >
              + スタッフを追加
            </button>
          </div>
        </div>

        <div style={contentStepStyle("news")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">お知らせ（任意）</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              実際のお知らせがある場合のみ入力してください。未入力の場合はAIが件数・内容とも自動生成します。
            </p>

            {news.length > 0 && (
              <ul className="mt-4 space-y-4">
                {news.map((item, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-3">
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">日付（任意）</span>
                          <input
                            type="text"
                            name="newsDate"
                            placeholder="例: 2026.01.15"
                            value={item.date}
                            onChange={(e) => updateNewsItem(i, "date", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">タイトル</span>
                          <input
                            type="text"
                            name="newsTitle"
                            placeholder="例: 年末年始の診療時間について"
                            value={item.title}
                            onChange={(e) => updateNewsItem(i, "title", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewsItem(i)}
                        className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50"
                        aria-label="このお知らせを削除"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={addNewsItem}
              className="mt-4 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
            >
              + お知らせを追加
            </button>
          </div>
        </div>

        <div style={contentStepStyle("pricing")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">料金表（任意）</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              金額は創作しないため、実際の料金がある場合のみ入力してください。未入力の場合、料金表セクションは非表示になります。
            </p>

            {priceItems.length > 0 && (
              <ul className="mt-4 space-y-4">
                {priceItems.map((item, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">項目名</span>
                          <input
                            type="text"
                            name="priceName"
                            placeholder="例: 初診料"
                            value={item.name}
                            onChange={(e) => updatePriceItem(i, "name", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">金額</span>
                          <input
                            type="text"
                            name="pricePrice"
                            placeholder="例: ¥3,000（税込）"
                            value={item.price}
                            onChange={(e) => updatePriceItem(i, "price", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-[12px] font-medium text-slate-700">備考（任意）</span>
                          <input
                            type="text"
                            name="priceNote"
                            placeholder="例: 保険適用外"
                            value={item.note}
                            onChange={(e) => updatePriceItem(i, "note", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePriceItem(i)}
                        className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50"
                        aria-label="この料金項目を削除"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={addPriceItem}
              className="mt-4 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
            >
              + 料金項目を追加
            </button>
          </div>
        </div>

        <div style={contentStepStyle("faq")} className="space-y-6">
          <div className={cardClassName}>
            <p className="text-[13px] font-medium text-slate-700">よくある質問（任意）</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              実際の質問と回答がある場合のみ入力してください。入力した内容がそのまま掲載されます。未入力の場合はAIが一般的なQ&amp;Aを自動生成します。
            </p>

            {faqs.length > 0 && (
              <ul className="mt-4 space-y-4">
                {faqs.map((faq, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-3">
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">質問</span>
                          <input
                            type="text"
                            name="faqQuestion"
                            placeholder="例: 予約は必要ですか？"
                            value={faq.question}
                            onChange={(e) => updateFaq(i, "question", e.target.value)}
                            className={inputClassName}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[12px] font-medium text-slate-700">回答</span>
                          <textarea
                            name="faqAnswer"
                            placeholder="例: 当日受付も可能ですが、web予約が便利です。"
                            value={faq.answer}
                            onChange={(e) => updateFaq(i, "answer", e.target.value)}
                            rows={2}
                            className={inputClassName}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFaq(i)}
                        className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50"
                        aria-label="この質問を削除"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={addFaq}
              className="mt-4 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
            >
              + 質問を追加
            </button>
          </div>
        </div>

        <div style={contentStepStyle("request")} className="space-y-6">
          <div className={cardClassName}>
            <label className="block">
              <span className="text-[13px] font-medium text-slate-700">ご要望</span>
              <textarea
                name="request"
                placeholder="デザインや内容についての要望があれば入力してください。"
                defaultValue={DEFAULT_REQUEST}
                rows={6}
                className={inputClassName}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleContentBack}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-slate-600 hover:bg-slate-50"
          >
            <span aria-hidden>←</span>
            戻る
          </button>
          <button
            type="button"
            onClick={handleContentNext}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500"
          >
            {currentContentStepIndex < contentSteps.length - 1 ? "次のセクションへ" : "次へ：デザイン選択"}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {/* ステップ3: デザイン選択（配色に関係しない雰囲気・フォント・カード形状） */}
      <div className="space-y-6" style={stepStyle(3)}>
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">
            デザイン
            <span className="ml-1 text-sky-500">*</span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            レイアウトの雰囲気・フォント・文章のトーンです。配色はStep1で選んだ色がそのまま使われます。
          </p>
          {presets.length === 0 ? (
            <p className="mt-3 text-[13px] text-slate-400">利用可能なデザインがありません。</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {presets.map((preset) => (
                <li key={preset.id}>
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 text-[13px] transition-colors ${
                      templateId === preset.id ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="templateId"
                        value={preset.id}
                        checked={templateId === preset.id}
                        onChange={() => selectPreset(preset)}
                        className="h-4 w-4 text-sky-600 focus:ring-0"
                        required
                      />
                      <span className="font-medium text-slate-900">{preset.label}</span>
                    </span>
                    {preset.notes && <span className="pl-6 text-[12px] leading-relaxed text-slate-400">{preset.notes}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => goToContentStep(contentSteps.length - 1)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-slate-600 hover:bg-slate-50"
          >
            <span aria-hidden>←</span>
            戻る：セクション情報を入力
          </button>
          <button
            type="button"
            onClick={() => goToStep(4)}
            disabled={presets.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            次へ：確認して作成
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {/* ステップ4: 確認して作成 */}
      <div className="space-y-6" style={stepStyle(4)}>
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">この内容でホームページを作成します</p>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">クリニック名</dt>
              <dd className="text-right text-slate-800">{clinicName || "（未入力）"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">カラー</dt>
              <dd className="flex items-center justify-end gap-2 text-right text-slate-800">
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: colors.find((c) => c.id === colorScheme)?.tokens.primary }}
                />
                {colors.find((c) => c.id === colorScheme)?.label ?? "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">デザイン</dt>
              <dd className="text-right text-slate-800">{selectedPreset?.label ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">表示するセクション</dt>
              <dd className="text-right text-slate-800">
                {sectionRows.filter((r) => r.visible).map((r) => r.label).join("・") || "（なし）"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => goToStep(3)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-slate-600 hover:bg-slate-50"
          >
            <span aria-hidden>←</span>
            戻る：デザイン選択
          </button>
          <button
            type="submit"
            disabled={busy || presets.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "アップロード中..." : pending ? "生成中..." : "作成"}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </form>
  );
}
