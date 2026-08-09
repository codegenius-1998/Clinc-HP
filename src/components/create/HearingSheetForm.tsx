"use client";

import { useActionState, useState } from "react";
import { createHearingAction, type HearingFormState } from "@/lib/actions";
import type { TemplateSummary } from "@/lib/templates";

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none";

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8";

const initialState: HearingFormState = { error: null };

export function HearingSheetForm({ templates }: { templates: TemplateSummary[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createHearingAction, initialState);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? templates[0];

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {state.error}
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
            <input type="text" name="clinicName" placeholder="〇〇クリニック" required className={inputClassName} />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">院長名</span>
            <input type="text" name="directorName" placeholder="山田 太郎" className={inputClassName} />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">住所</span>
            <input type="text" name="address" placeholder="東京都〇〇区〇〇1-2-3" className={inputClassName} />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">電話番号</span>
            <input type="tel" name="phone" placeholder="03-1234-5678" className={inputClassName} />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-slate-700">LINE</span>
            <input type="text" name="line" placeholder="@example" className={inputClassName} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-[13px] font-medium text-slate-700">診療時間</span>
          <textarea
            name="hours"
            placeholder={"例:\n月〜金 9:00-13:00 / 15:00-19:00\n土 9:00-13:00\n日・祝 休診"}
            rows={3}
            className={inputClassName}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[13px] font-medium text-slate-700">医院の特徴</span>
          <textarea
            name="features"
            placeholder="例: 土日診療、キッズスペース完備、駅から徒歩3分"
            rows={3}
            className={inputClassName}
          />
        </label>
      </div>

      <div className={cardClassName}>
        <label className="block">
          <span className="text-[13px] font-medium text-slate-700">ご要望</span>
          <textarea
            name="request"
            placeholder="デザインや内容についての要望があれば入力してください。"
            rows={4}
            className={inputClassName}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending || templates.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "送信中..." : "ヒアリングシートを送信"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
