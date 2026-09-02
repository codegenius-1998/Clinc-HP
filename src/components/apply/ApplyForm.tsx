"use client";

import { startTransition, useActionState, useState } from "react";
import { createApplicationAction, type ApplicationFormState } from "@/lib/applicationActions";
import { IMAGE_CATEGORIES, type ImageCategoryKey } from "@/lib/imageCategories";
import type { Department, Service, Feature, Target } from "@/lib/content";

type PickedImage = { kind: "file"; file: File; previewUrl: string } | { kind: "url"; url: string };

function previewSrc(img: PickedImage): string {
  return img.kind === "file" ? img.previewUrl : img.url;
}

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none";

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8";

const initialState: ApplicationFormState = { error: null };

const STEP_TITLES = [
  "基本情報",
  "写真",
  "診療科",
  "特徴",
  "ターゲット",
  "診療時間",
  "院長紹介",
  "料金表",
  "よくあるご質問",
  "お知らせ",
  "ご要望",
  "申請",
];

const DIRECTOR_ROLE_OPTIONS = ["院長", "副院長", "理事長", "医師"];

/** One line under each photo category explaining where it is used on the generated site. */
const CATEGORY_USAGE: Record<ImageCategoryKey, string> = {
  exterior: "建物の外観。アクセス欄・トップページ背景に使われます。",
  interior: "待合・受付・診察室など。院内ギャラリーに並びます。",
  atmosphere: "診療の雰囲気。診療案内カードや院内ギャラリーに使われます。",
};

// --- 診療時間 (structured, same shape as the generated site's schedule JSON) ---
const SCHEDULE_DAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;
const SCHEDULE_MARKS = ["●", "▲", "／"] as const;
const MARK_LABEL: Record<string, string> = { "●": "診療", "▲": "午前のみ", "／": "休診" };
function nextMark(m: string): string {
  const i = SCHEDULE_MARKS.indexOf(m as (typeof SCHEDULE_MARKS)[number]);
  return SCHEDULE_MARKS[(i + 1) % SCHEDULE_MARKS.length];
}

type ScheduleRowInput = { label: string; marks: string[] };
type PriceItemInput = { name: string; price: string; note: string };
type FaqInput = { question: string; answer: string };
type NewsInput = { date: string; title: string };

function emptyImagesByCategory(): Record<ImageCategoryKey, PickedImage[]> {
  const entries = IMAGE_CATEGORIES.map((c) => [c.key, [] as PickedImage[]] as const);
  return Object.fromEntries(entries) as Record<ImageCategoryKey, PickedImage[]>;
}

export function ApplyForm({
  departments,
  services,
  features,
  targets,
}: {
  departments: Department[];
  services: Service[];
  features: Feature[];
  targets: Target[];
}) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createApplicationAction, initialState);

  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [line, setLine] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [directorRole, setDirectorRole] = useState("院長");
  const [directorGreeting, setDirectorGreeting] = useState("");
  const [directorPhoto, setDirectorPhoto] = useState<PickedImage | null>(null);
  const [directorPhotoUrlDraft, setDirectorPhotoUrlDraft] = useState("");
  const [priceItems, setPriceItems] = useState<PriceItemInput[]>([]);
  const [faqItems, setFaqItems] = useState<FaqInput[]>([]);
  const [newsItems, setNewsItems] = useState<NewsInput[]>([]);
  const [heroImage, setHeroImage] = useState<PickedImage | null>(null);
  const [heroImageUrlDraft, setHeroImageUrlDraft] = useState("");

  const [scheduleRows, setScheduleRows] = useState<ScheduleRowInput[]>([
    { label: "9:00 - 12:30", marks: ["●", "●", "●", "●", "●", "▲", "／"] },
    { label: "14:00 - 18:00", marks: ["●", "●", "●", "●", "●", "／", "／"] },
  ]);
  const [scheduleNotes, setScheduleNotes] = useState<string[]>([]);

  const [imagesByCategory, setImagesByCategory] = useState<Record<ImageCategoryKey, PickedImage[]>>(emptyImagesByCategory);
  const [categoryUrlDraft, setCategoryUrlDraft] = useState<Record<ImageCategoryKey, string>>(
    () => Object.fromEntries(IMAGE_CATEGORIES.map((c) => [c.key, ""])) as Record<ImageCategoryKey, string>
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const busy = uploading || pending;

  function toggleSelected(set: Set<string>, id: string, setSet: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
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

  // --- 診療時間 ---
  function addScheduleRow() {
    setScheduleRows((prev) => [...prev, { label: "", marks: SCHEDULE_DAYS.map(() => "●") }]);
  }
  function updateScheduleLabel(rowIdx: number, value: string) {
    setScheduleRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, label: value } : r)));
  }
  function cycleScheduleMark(rowIdx: number, dayIdx: number) {
    setScheduleRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx ? { ...r, marks: r.marks.map((m, j) => (j === dayIdx ? nextMark(m) : m)) } : r
      )
    );
  }
  function removeScheduleRow(rowIdx: number) {
    setScheduleRows((prev) => prev.filter((_, i) => i !== rowIdx));
  }
  function addScheduleNote() {
    setScheduleNotes((prev) => [...prev, ""]);
  }
  function updateScheduleNote(idx: number, value: string) {
    setScheduleNotes((prev) => prev.map((n, i) => (i === idx ? value : n)));
  }
  function removeScheduleNote(idx: number) {
    setScheduleNotes((prev) => prev.filter((_, i) => i !== idx));
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

  function addFaqItem() {
    setFaqItems((prev) => [...prev, { question: "", answer: "" }]);
  }
  function updateFaqItem(index: number, field: keyof FaqInput, value: string) {
    setFaqItems((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }
  function removeFaqItem(index: number) {
    setFaqItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addNewsItem() {
    setNewsItems((prev) => [...prev, { date: "", title: "" }]);
  }
  function updateNewsItem(index: number, field: keyof NewsInput, value: string) {
    setNewsItems((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value } : n)));
  }
  function removeNewsItem(index: number) {
    setNewsItems((prev) => prev.filter((_, i) => i !== index));
  }

  function setHeroImageFile(file: File | null) {
    setHeroImage((prev) => {
      if (prev?.kind === "file") URL.revokeObjectURL(prev.previewUrl);
      return file ? { kind: "file", file, previewUrl: URL.createObjectURL(file) } : null;
    });
  }
  function registerHeroImageUrl() {
    const url = heroImageUrlDraft.trim();
    if (!url) return;
    setHeroImage((prev) => {
      if (prev?.kind === "file") URL.revokeObjectURL(prev.previewUrl);
      return { kind: "url", url };
    });
    setHeroImageUrlDraft("");
  }

  function setDirectorPhotoFile(file: File | null) {
    setDirectorPhoto((prev) => {
      if (prev?.kind === "file") URL.revokeObjectURL(prev.previewUrl);
      return file ? { kind: "file", file, previewUrl: URL.createObjectURL(file) } : null;
    });
  }
  function registerDirectorPhotoUrl() {
    const url = directorPhotoUrlDraft.trim();
    if (!url) return;
    setDirectorPhoto((prev) => {
      if (prev?.kind === "file") URL.revokeObjectURL(prev.previewUrl);
      return { kind: "url", url };
    });
    setDirectorPhotoUrlDraft("");
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

  function goTo(next: number) {
    setStepError(null);
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext() {
    if (step === 0 && !clinicName.trim()) {
      setStepError("クリニック名を入力してください。");
      return;
    }
    goTo(Math.min(step + 1, STEP_TITLES.length - 1));
  }

  function handleBack() {
    goTo(Math.max(step - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setUploadError(null);

    // Structured 診療時間 — same shape as the generated site's `sections.schedule`.
    const cleanRows = scheduleRows
      .map((r) => ({ label: r.label.trim(), marks: r.marks }))
      .filter((r) => r.label.length > 0 || r.marks.some((m) => m !== "／"));
    formData.append(
      "schedule",
      JSON.stringify({
        days: [...SCHEDULE_DAYS],
        rows: cleanRows,
        notes: scheduleNotes.map((n) => n.trim()).filter(Boolean),
      })
    );

    for (const category of IMAGE_CATEGORIES) {
      for (const img of imagesByCategory[category.key]) {
        if (img.kind === "url") formData.append(`imageUrls_${category.key}`, img.url);
      }
    }
    if (heroImage?.kind === "url") formData.append("imageUrls_hero", heroImage.url);
    if (directorPhoto?.kind === "url") formData.append("directorPhotoUrl", directorPhoto.url);

    const categoriesNeedingUpload = IMAGE_CATEGORIES.filter((c) =>
      imagesByCategory[c.key].some((img) => img.kind === "file")
    );
    const heroNeedsUpload = heroImage?.kind === "file";
    const directorNeedsUpload = directorPhoto?.kind === "file";

    if (categoriesNeedingUpload.length > 0 || heroNeedsUpload || directorNeedsUpload) {
      setUploading(true);
      try {
        if (heroImage?.kind === "file") {
          formData.append("imageUrls_hero", await uploadOne("hero", heroImage.file));
        }
        if (directorPhoto?.kind === "file") {
          formData.append("directorPhotoUrl", await uploadOne("director", directorPhoto.file));
        }
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
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "画像のアップロードに失敗しました。");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  const stepStyle = (n: number): React.CSSProperties => ({ display: step === n ? undefined : "none" });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
        {STEP_TITLES.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                step === i ? "bg-sky-600 text-white" : step > i ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}
            </span>
            <span className={step === i ? "font-medium text-slate-700" : ""}>{label}</span>
            {i < STEP_TITLES.length - 1 && <span className="mx-1 text-slate-300">→</span>}
          </li>
        ))}
      </ol>

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
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-700">申請を送信しています…</p>
      )}

      {/* Step 0: 基本情報 */}
      <div style={stepStyle(0)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">基本情報</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">クリニックの基本情報を入力してください。</p>
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
              <span className="text-[13px] font-medium text-slate-700">住所</span>
              <input
                type="text"
                name="address"
                placeholder="東京都〇〇区〇〇1-2-3"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-slate-700">電話番号</span>
              <input
                type="tel"
                name="phone"
                placeholder="03-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-slate-700">LINE</span>
              <input
                type="text"
                name="line"
                placeholder="@example"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                className={inputClassName}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Step 1: 写真 */}
      <div style={stepStyle(1)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">写真（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            外部・内部・治療の雰囲気がわかる写真をカテゴリごとにアップロードしてください。指定の無いカテゴリはAIが自動生成します。
          </p>
          <div className="mt-5 space-y-5">
            {IMAGE_CATEGORIES.map((category) => (
              <div key={category.key} className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
                <label className="block">
                  <span className="text-[13px] font-medium text-slate-700">{category.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                    {CATEGORY_USAGE[category.key]}
                  </span>
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

            <div className="border-t border-slate-100 pt-5">
              <p className="text-[13px] font-medium text-slate-700">トップページの大きな画像（任意）</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                1枚だけ。トップの背景として大きく表示されます。未指定なら装飾イラストになります。
              </p>
              {heroImage ? (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc(heroImage)}
                    alt=""
                    className="h-20 w-32 rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setHeroImageFile(null)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"
                  >
                    画像を削除
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setHeroImageFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    className="mt-2 block w-full text-[13px] text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-[13px] file:text-white"
                  />
                  <div className="mt-2 flex gap-2">
                    <input
                      type="url"
                      placeholder="画像URLを入力して登録"
                      value={heroImageUrlDraft}
                      onChange={(e) => setHeroImageUrlDraft(e.target.value)}
                      className={`${inputClassName} mt-0`}
                    />
                    <button
                      type="button"
                      onClick={registerHeroImageUrl}
                      className="mt-0 shrink-0 rounded-lg border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
                    >
                      URLから登録
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: 診療科・サービス選択 */}
      <div style={stepStyle(2)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">診療科・サービス（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">提供する診療科・サービスを選択してください。</p>
          <div className="mt-4 space-y-5">
            {departments.map((department) => {
              const departmentServices = services.filter((s) => s.department_id === department.id);
              if (departmentServices.length === 0) return null;
              return (
                <div key={department.id}>
                  <p className="text-[13px] font-medium text-slate-700">{department.name}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {departmentServices.map((service) => (
                      <li key={service.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[13px] text-slate-700 transition-colors has-checked:border-sky-400 has-checked:bg-sky-50 has-checked:text-sky-700">
                          <input
                            type="checkbox"
                            name="serviceId"
                            value={service.id}
                            checked={selectedServiceIds.has(service.id)}
                            onChange={() => toggleSelected(selectedServiceIds, service.id, setSelectedServiceIds)}
                            className="h-3.5 w-3.5 rounded text-sky-600 focus:ring-0"
                          />
                          {service.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {departments.length === 0 && (
              <p className="text-[13px] text-slate-400">選択可能な診療科がまだ登録されていません。</p>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: 特徴選択 */}
      <div style={stepStyle(3)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">医院の特徴（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">当てはまる特徴を選択してください。</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {features.map((feature) => (
              <li key={feature.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[13px] text-slate-700 transition-colors has-checked:border-sky-400 has-checked:bg-sky-50 has-checked:text-sky-700">
                  <input
                    type="checkbox"
                    name="featureId"
                    value={feature.id}
                    checked={selectedFeatureIds.has(feature.id)}
                    onChange={() => toggleSelected(selectedFeatureIds, feature.id, setSelectedFeatureIds)}
                    className="h-3.5 w-3.5 rounded text-sky-600 focus:ring-0"
                  />
                  {feature.name}
                </label>
              </li>
            ))}
            {features.length === 0 && <p className="text-[13px] text-slate-400">選択可能な特徴がまだ登録されていません。</p>}
          </ul>
        </div>
      </div>

      {/* Step 4: ターゲット選択 */}
      <div style={stepStyle(4)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">ターゲット（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">想定する患者層を選択してください。</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {targets.map((target) => (
              <li key={target.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[13px] text-slate-700 transition-colors has-checked:border-sky-400 has-checked:bg-sky-50 has-checked:text-sky-700">
                  <input
                    type="checkbox"
                    name="targetId"
                    value={target.id}
                    checked={selectedTargetIds.has(target.id)}
                    onChange={() => toggleSelected(selectedTargetIds, target.id, setSelectedTargetIds)}
                    className="h-3.5 w-3.5 rounded text-sky-600 focus:ring-0"
                  />
                  {target.name}
                </label>
              </li>
            ))}
            {targets.length === 0 && <p className="text-[13px] text-slate-400">選択可能なターゲットがまだ登録されていません。</p>}
          </ul>
        </div>
      </div>

      {/* Step 5: 診療時間 */}
      <div style={stepStyle(5)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">診療時間（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            時間帯ごとに、曜日のマークを押して切り替えてください（記載どおりそのまま掲載します）。
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            <span className="font-medium text-slate-700">●</span> 診療
            <span className="font-medium text-slate-700">▲</span> 午前のみ
            <span className="font-medium text-slate-700">／</span> 休診
          </p>

          <ul className="mt-4 space-y-4">
            {scheduleRows.map((row, ri) => (
              <li key={ri} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="block">
                      <span className="text-[12px] font-medium text-slate-700">時間帯</span>
                      <input
                        type="text"
                        placeholder="例: 9:00 - 12:30"
                        value={row.label}
                        onChange={(e) => updateScheduleLabel(ri, e.target.value)}
                        className={inputClassName}
                      />
                    </label>
                    <div className="mt-3 grid grid-cols-7 gap-1.5">
                      {SCHEDULE_DAYS.map((day, di) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => cycleScheduleMark(ri, di)}
                          aria-label={`${day}曜: ${MARK_LABEL[row.marks[di]] ?? "診療"}（押して切替）`}
                          className="flex flex-col items-center gap-0.5 rounded-md border border-slate-200 py-1.5 hover:border-sky-300 hover:bg-sky-50"
                        >
                          <span className="text-[10px] text-slate-400">{day}</span>
                          <span
                            className={`text-[15px] leading-none ${
                              row.marks[di] === "／" ? "text-slate-300" : row.marks[di] === "▲" ? "text-amber-500" : "text-sky-600"
                            }`}
                          >
                            {row.marks[di]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeScheduleRow(ri)}
                    className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50"
                    aria-label="この時間帯を削除"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addScheduleRow}
            className="mt-3 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
          >
            + 時間帯を追加
          </button>

          <div className="mt-6">
            <p className="text-[12px] font-medium text-slate-700">補足（任意）</p>
            <p className="mt-0.5 text-[11px] text-slate-400">休診日や受付終了時間などの注記。</p>
            {scheduleNotes.length > 0 && (
              <ul className="mt-2 space-y-2">
                {scheduleNotes.map((note, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="例: 木曜午後・日曜・祝日は休診"
                      value={note}
                      onChange={(e) => updateScheduleNote(i, e.target.value)}
                      className={`${inputClassName} mt-0`}
                    />
                    <button
                      type="button"
                      onClick={() => removeScheduleNote(i)}
                      className="shrink-0 rounded p-2 text-[13px] text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addScheduleNote}
              className="mt-2 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
            >
              + 補足を追加
            </button>
          </div>
        </div>
      </div>

      {/* Step 6: 院長紹介 */}
      <div style={stepStyle(6)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">院長紹介（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            サイトの「当院について（ごあいさつ）」に使います。ごあいさつ文が未入力の場合はAIが作成します。
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-medium text-slate-700">院長名</span>
              <input
                type="text"
                name="directorName"
                placeholder="山田 太郎"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-slate-700">肩書き</span>
              <input
                type="text"
                name="directorRole"
                list="director-role-options"
                placeholder="院長"
                value={directorRole}
                onChange={(e) => setDirectorRole(e.target.value)}
                className={inputClassName}
              />
              <datalist id="director-role-options">
                {DIRECTOR_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-[13px] font-medium text-slate-700">ごあいさつ文</span>
            <textarea
              name="directorGreeting"
              placeholder={"例:\n地域のみなさまが気軽に相談できる診療所を目指しています。\n\n小さな不調こそ、早めにご相談ください。"}
              value={directorGreeting}
              onChange={(e) => setDirectorGreeting(e.target.value)}
              rows={5}
              className={inputClassName}
            />
            <span className="mt-1 block text-[11px] text-slate-400">空行で段落が分かれます。</span>
          </label>
          <div className="mt-4">
            <p className="text-[13px] font-medium text-slate-700">院長写真（任意）</p>
            <p className="mt-0.5 text-[11px] text-slate-400">未指定の場合はAIが生成します。</p>
            {directorPhoto ? (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc(directorPhoto)}
                  alt=""
                  className="h-20 w-16 rounded-lg border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setDirectorPhotoFile(null)}
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
                    setDirectorPhotoFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                  className="mt-2 block w-full text-[13px] text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-[13px] file:text-white"
                />
                <div className="mt-2 flex gap-2">
                  <input
                    type="url"
                    placeholder="画像URLを入力して登録"
                    value={directorPhotoUrlDraft}
                    onChange={(e) => setDirectorPhotoUrlDraft(e.target.value)}
                    className={`${inputClassName} mt-0`}
                  />
                  <button
                    type="button"
                    onClick={registerDirectorPhotoUrl}
                    className="mt-0 shrink-0 rounded-lg border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
                  >
                    URLから登録
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Step 7: 料金表 */}
      <div style={stepStyle(7)} className="space-y-6">
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

      {/* Step 8: よくあるご質問 */}
      <div style={stepStyle(8)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">よくあるご質問（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            サイトの「よくあるご質問」に載せる Q&amp;A です。未入力の場合はAIが一般的な内容を生成します。
          </p>

          {faqItems.length > 0 && (
            <ul className="mt-4 space-y-4">
              {faqItems.map((item, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <label className="block">
                        <span className="text-[12px] font-medium text-slate-700">質問</span>
                        <input
                          type="text"
                          name="faqQuestion"
                          placeholder="例: 予約は必要ですか？"
                          value={item.question}
                          onChange={(e) => updateFaqItem(i, "question", e.target.value)}
                          className={inputClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[12px] font-medium text-slate-700">回答</span>
                        <textarea
                          name="faqAnswer"
                          placeholder="例: ご予約をおすすめしていますが、当日の受付も可能です。"
                          value={item.answer}
                          onChange={(e) => updateFaqItem(i, "answer", e.target.value)}
                          rows={2}
                          className={inputClassName}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFaqItem(i)}
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
            onClick={addFaqItem}
            className="mt-4 rounded-full border border-sky-200 px-4 py-2 text-[13px] font-medium text-sky-700 hover:bg-sky-50"
          >
            + 質問を追加
          </button>
        </div>
      </div>

      {/* Step 9: お知らせ */}
      <div style={stepStyle(9)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">お知らせ（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            サイトの「お知らせ」に載せる項目です。未入力の場合はAIが一般的な内容を生成します。
          </p>

          {newsItems.length > 0 && (
            <ul className="mt-4 space-y-4">
              {newsItems.map((item, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid flex-1 gap-3 sm:grid-cols-[10rem_1fr]">
                      <label className="block">
                        <span className="text-[12px] font-medium text-slate-700">日付</span>
                        <input
                          type="text"
                          name="newsDate"
                          placeholder="2026.08.01"
                          value={item.date}
                          onChange={(e) => updateNewsItem(i, "date", e.target.value)}
                          className={inputClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[12px] font-medium text-slate-700">見出し</span>
                        <input
                          type="text"
                          name="newsTitle"
                          placeholder="例: 夏季休診のお知らせ"
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

      {/* Step 10: ご要望 */}
      <div style={stepStyle(10)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">ご要望（任意）</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            ホームページの雰囲気や、載せたいこと・載せたくないことがあれば教えてください。
            デザインの自動選択と文章づくりの参考にします。
          </p>
          <textarea
            name="request"
            placeholder={"例:\n・お子さん連れでも入りやすい、明るい雰囲気にしたい\n・院内の写真を大きく見せたい\n・専門用語は少なめでお願いします"}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={6}
            className={inputClassName}
          />
        </div>
      </div>

      {/* Step 11: 申請 */}
      <div style={stepStyle(11)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">この内容で申請します</p>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">クリニック名</dt>
              <dd className="text-right text-slate-800">{clinicName || "（未入力）"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">住所</dt>
              <dd className="text-right text-slate-800">{address || "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">電話番号</dt>
              <dd className="text-right text-slate-800">{phone || "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">LINE</dt>
              <dd className="text-right text-slate-800">{line || "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">診療科・サービス</dt>
              <dd className="text-right text-slate-800">
                {services.filter((s) => selectedServiceIds.has(s.id)).map((s) => s.name).join("・") || "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">特徴</dt>
              <dd className="text-right text-slate-800">
                {features.filter((f) => selectedFeatureIds.has(f.id)).map((f) => f.name).join("・") || "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">ターゲット</dt>
              <dd className="text-right text-slate-800">
                {targets.filter((t) => selectedTargetIds.has(t.id)).map((t) => t.name).join("・") || "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">診療時間</dt>
              <dd className="text-right text-slate-800">
                {scheduleRows.filter((r) => r.label.trim()).length > 0
                  ? `${scheduleRows.filter((r) => r.label.trim()).length}行`
                  : "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">院長紹介</dt>
              <dd className="text-right text-slate-800">
                {directorName.trim() || directorGreeting.trim() || directorPhoto
                  ? [directorName.trim() && `${directorName.trim()}（${directorRole.trim() || "院長"}）`, directorPhoto && "写真あり"]
                      .filter(Boolean)
                      .join(" ") || "入力あり"
                  : "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">料金表</dt>
              <dd className="text-right text-slate-800">
                {priceItems.filter((p) => p.name.trim()).length > 0
                  ? `${priceItems.filter((p) => p.name.trim()).length}件`
                  : "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">よくあるご質問</dt>
              <dd className="text-right text-slate-800">
                {faqItems.filter((f) => f.question.trim() && f.answer.trim()).length > 0
                  ? `${faqItems.filter((f) => f.question.trim() && f.answer.trim()).length}件`
                  : "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">お知らせ</dt>
              <dd className="text-right text-slate-800">
                {newsItems.filter((n) => n.title.trim()).length > 0
                  ? `${newsItems.filter((n) => n.title.trim()).length}件`
                  : "（なし）"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">トップ画像</dt>
              <dd className="text-right text-slate-800">{heroImage ? "あり" : "（なし）"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">ご要望</dt>
              <dd className="whitespace-pre-line text-right text-slate-800">{request || "（なし）"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
            申請後、管理側でデザインテンプレートを割り当ててホームページを生成します。生成が完了すると「サイト一覧」で確認できます。
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {step > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-slate-600 hover:bg-slate-50"
          >
            <span aria-hidden>←</span>
            戻る
          </button>
        )}
        {step < STEP_TITLES.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500"
          >
            次へ：{STEP_TITLES[step + 1]}
            <span aria-hidden>→</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "アップロード中..." : pending ? "送信中..." : "申請する"}
            <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </form>
  );
}
