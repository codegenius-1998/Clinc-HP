"use client";

import { startTransition, useActionState, useState } from "react";
import { createApplicationAction, type ApplicationFormState } from "@/lib/applicationActions";
import type { ColorTheme } from "@/lib/designPresets";
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

const STEP_TITLES = ["基本情報", "サイトカラー", "写真", "診療科・サービス", "医院の特徴", "ターゲット", "確認・申請"];

function emptyImagesByCategory(): Record<ImageCategoryKey, PickedImage[]> {
  const entries = IMAGE_CATEGORIES.map((c) => [c.key, [] as PickedImage[]] as const);
  return Object.fromEntries(entries) as Record<ImageCategoryKey, PickedImage[]>;
}

export function ApplyForm({
  colors,
  departments,
  services,
  features,
  targets,
}: {
  colors: ColorTheme[];
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
  const [colorScheme, setColorScheme] = useState(colors[0]?.id ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());

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
    if (step === 1 && !colorScheme) {
      setStepError("サイトカラーを選択してください。");
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

    for (const category of IMAGE_CATEGORIES) {
      for (const img of imagesByCategory[category.key]) {
        if (img.kind === "url") formData.append(`imageUrls_${category.key}`, img.url);
      }
    }

    const categoriesNeedingUpload = IMAGE_CATEGORIES.filter((c) =>
      imagesByCategory[c.key].some((img) => img.kind === "file")
    );

    if (categoriesNeedingUpload.length > 0) {
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
  const selectedColor = colors.find((c) => c.id === colorScheme);

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

      {/* Step 1: サイトカラー */}
      <div style={stepStyle(1)} className="space-y-6">
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">
            サイトカラー
            <span className="ml-1 text-sky-500">*</span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">サイト全体の配色を選択してください。</p>
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
            {colors.length === 0 && <p className="text-[13px] text-slate-400">選択可能なカラーがありません。</p>}
          </ul>
        </div>
      </div>

      {/* Step 2: 写真 */}
      <div style={stepStyle(2)} className="space-y-6">
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

      {/* Step 3: 診療科・サービス選択 */}
      <div style={stepStyle(3)} className="space-y-6">
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

      {/* Step 4: 特徴選択 */}
      <div style={stepStyle(4)} className="space-y-6">
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

      {/* Step 5: ターゲット選択 */}
      <div style={stepStyle(5)} className="space-y-6">
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

      {/* Step 6: 確認・申請 */}
      <div style={stepStyle(6)} className="space-y-6">
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
              <dt className="text-slate-400">サイトカラー</dt>
              <dd className="flex items-center justify-end gap-2 text-right text-slate-800">
                {selectedColor && (
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: selectedColor.tokens.primary }}
                  />
                )}
                {selectedColor?.label ?? "-"}
              </dd>
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
