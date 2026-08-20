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

const STEP_TITLES = ["基本情報", "写真", "診療科", "特徴", "ターゲット", "診療時間", "スタッフ紹介", "料金表", "申請"];

const STAFF_ROLE_OPTIONS = ["院長", "副院長", "医師", "看護師", "薬剤師", "受付・事務", "スタッフ"];

type StaffMemberInput = { name: string; comment: string; role: string; photo: PickedImage | null; photoUrlDraft: string };
type PriceItemInput = { name: string; price: string; note: string };

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
  const [hours, setHours] = useState("");
  const [staffMembers, setStaffMembers] = useState<StaffMemberInput[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItemInput[]>([]);

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
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">記載の通りそのまま掲載します（AIによる書き換えはしません）。</p>
          <textarea
            name="hours"
            placeholder={"例:\n月〜金 9:00-13:00 / 15:00-19:00\n土 9:00-13:00\n日・祝 休診"}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            rows={4}
            className={inputClassName}
          />
        </div>
      </div>

      {/* Step 6: スタッフ紹介 */}
      <div style={stepStyle(6)} className="space-y-6">
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

      {/* Step 8: 確認・申請 */}
      <div style={stepStyle(8)} className="space-y-6">
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
              <dd className="whitespace-pre-line text-right text-slate-800">{hours || "（なし）"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">スタッフ紹介</dt>
              <dd className="text-right text-slate-800">
                {staffMembers.filter((m) => m.name.trim()).map((m) => m.name).join("・") || "（なし）"}
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
