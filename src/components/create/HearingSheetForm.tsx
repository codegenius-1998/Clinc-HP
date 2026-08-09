"use client";

import { startTransition, useActionState, useState } from "react";
import { createHearingAction, type HearingFormState } from "@/lib/actions";
import type { TemplateDefinition } from "@/lib/templates";
import { IMAGE_CATEGORIES, type ImageCategoryKey } from "@/lib/imageCategories";

type PickedImage = { file: File; previewUrl: string };

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

function emptyImagesByCategory(): Record<ImageCategoryKey, PickedImage[]> {
  const entries = IMAGE_CATEGORIES.map((c) => [c.key, [] as PickedImage[]] as const);
  return Object.fromEntries(entries) as Record<ImageCategoryKey, PickedImage[]>;
}

export function HearingSheetForm({ templates }: { templates: TemplateDefinition[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createHearingAction, initialState);
  const [imagesByCategory, setImagesByCategory] = useState<Record<ImageCategoryKey, PickedImage[]>>(emptyImagesByCategory);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? templates[0];
  const busy = uploading || pending;

  function handleImagesSelected(category: ImageCategoryKey, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setImagesByCategory((prev) => ({ ...prev, [category]: [...prev[category], ...picked] }));
  }

  function removeImage(category: ImageCategoryKey, index: number) {
    setImagesByCategory((prev) => {
      URL.revokeObjectURL(prev[category][index].previewUrl);
      return { ...prev, [category]: prev[category].filter((_, i) => i !== index) };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setUploadError(null);

    const categoriesWithImages = IMAGE_CATEGORIES.filter((c) => imagesByCategory[c.key].length > 0);
    if (categoriesWithImages.length > 0) {
      setUploading(true);
      try {
        for (const category of categoriesWithImages) {
          const uploadForm = new FormData();
          uploadForm.append("category", category.key);
          imagesByCategory[category.key].forEach(({ file }) => uploadForm.append("files", file));

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(uploadError || state.error) && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {uploadError ?? state.error}
        </p>
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

      <div className={cardClassName}>
        <p className="text-[13px] font-medium text-slate-700">
          テンプレート
          <span className="ml-1 text-sky-500">*</span>
        </p>
        {templates.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-400">利用可能なテンプレートがありません。</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {templates.map((template) => (
              <li key={template.id}>
                <label
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 text-[13px] transition-colors ${
                    templateId === template.id
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="templateId"
                      value={template.id}
                      checked={templateId === template.id}
                      onChange={() => setTemplateId(template.id)}
                      className="h-4 w-4 text-sky-600 focus:ring-0"
                      required
                    />
                    <span className="font-medium text-slate-900">{template.label}</span>
                  </span>
                  {template.notes && (
                    <span className="pl-6 text-[12px] leading-relaxed text-slate-400">{template.notes}</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedTemplate && selectedTemplate.colorSchemes.length > 0 && (
        <div className={cardClassName}>
          <p className="text-[13px] font-medium text-slate-700">
            カラー
            <span className="ml-1 text-sky-500">*</span>
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {selectedTemplate.colorSchemes.map((scheme, i) => (
              <li key={scheme.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[13px] text-slate-700 transition-colors has-checked:border-sky-400 has-checked:bg-sky-50 has-checked:text-sky-700">
                  <input
                    type="radio"
                    name="colorScheme"
                    value={scheme.id}
                    defaultChecked={i === 0}
                    className="h-3.5 w-3.5 text-sky-600 focus:ring-0"
                    required
                  />
                  {scheme.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cardClassName}>
        <p className="text-[13px] font-medium text-slate-700">医院情報</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
          分かる範囲で入力してください。クリニック名以外は未入力でも作成できます。
        </p>

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
              defaultValue={DEFAULT_CLINIC_NAME}
              required
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">院長名</span>
            <input
              type="text"
              name="directorName"
              placeholder="山田 太郎"
              defaultValue={DEFAULT_DIRECTOR_NAME}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">住所</span>
            <input
              type="text"
              name="address"
              placeholder="東京都〇〇区〇〇1-2-3"
              defaultValue={DEFAULT_ADDRESS}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">電話番号</span>
            <input
              type="tel"
              name="phone"
              placeholder="03-1234-5678"
              defaultValue={DEFAULT_PHONE}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">LINE</span>
            <input
              type="text"
              name="line"
              placeholder="@example"
              defaultValue={DEFAULT_LINE}
              className={inputClassName}
            />
          </label>

          <label className="block">
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

        <label className="mt-4 block">
          <span className="text-[13px] font-medium text-slate-700">診療時間</span>
          <textarea
            name="hours"
            placeholder={"例:\n月〜金 9:00-13:00 / 15:00-19:00\n土 9:00-13:00\n日・祝 休診"}
            defaultValue={DEFAULT_HOURS}
            rows={4}
            className={inputClassName}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[13px] font-medium text-slate-700">医院の特徴</span>
          <textarea
            name="features"
            placeholder="例: 土日診療、キッズスペース完備、駅から徒歩3分"
            defaultValue={DEFAULT_FEATURES}
            rows={8}
            className={inputClassName}
          />
        </label>
      </div>

      <div className={cardClassName}>
        <p className="text-[13px] font-medium text-slate-700">写真（カテゴリ別・任意）</p>
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

              {imagesByCategory[category.key].length > 0 && (
                <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {imagesByCategory[category.key].map((img, i) => (
                    <li
                      key={img.previewUrl}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
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

      <button
        type="submit"
        disabled={busy || templates.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {uploading ? "アップロード中..." : pending ? "生成中..." : "ヒアリングシートを送信"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
