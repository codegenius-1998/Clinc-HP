"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importTemplateAction, type ImportState } from "@/lib/template/templateActions";
import { inputClass } from "./adminStyles";

/** The "make a template from a reference site" form. It deliberately does NOT redirect on success:
 * the result — a live preview of the imported design, plus any warnings about what couldn't be read
 * from the reference — is the whole point, and an admin needs to see it before deciding whether the
 * template is worth keeping. */
export function TemplateImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importTemplateAction, {
    error: null,
    result: null,
  });

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="url" className="text-[14px] text-slate-500">
            参考サイトのURL
          </label>
          <input
            id="url"
            name="url"
            type="url"
            placeholder="https://example.com"
            className={inputClass}
          />
          <p className="text-[13px] text-slate-400">
            HTMLとCSSを読み取り、配色・書体・角丸・影・動きを分析します。文章や写真は取り込みません。
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="imageUrls" className="text-[14px] text-slate-500">
            参考画像のURL（任意・1行に1つ、4つまで）
          </label>
          <textarea
            id="imageUrls"
            name="imageUrls"
            rows={3}
            placeholder={"https://example.com/screenshot.png\nhttps://example.com/design.jpg"}
            className={`${inputClass} font-mono`}
          />
          <p className="text-[13px] text-slate-400">
            スクリーンショットやデザインカンプの画像URL。見た目の印象はこちらの方が正確に読み取れます。
            JavaScriptで描画されるサイトを参考にする場合は、画像を指定してください。
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-[14px] text-slate-500">
            テンプレート名（任意）
          </label>
          <input id="name" name="name" className={inputClass} placeholder="空欄の場合はAIが名前を付けます" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-60"
          >
            {pending ? "解析中…（30秒ほどかかります）" : "解析してテンプレートを作る"}
          </button>
          {pending && <span className="text-[14px] text-slate-400">サイトの取得とAIによる分析を行っています。</span>}
        </div>

        {state.error && (
          <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
            {state.error}
          </p>
        )}
      </form>

      {state.result && (
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] text-emerald-700">テンプレートを作成しました</p>
              <p className="text-[18px] font-medium text-slate-900">{state.result.name}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={state.result.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[14px] text-slate-700 transition-colors hover:bg-slate-50"
              >
                新しいタブで開く
              </a>
              <Link
                href={`/admin/templates/${state.result.id}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-[14px] text-white transition-colors hover:bg-slate-700"
              >
                編集する
              </Link>
            </div>
          </div>

          {state.result.mood && <p className="text-[14px] leading-relaxed text-slate-600">{state.result.mood}</p>}
          {state.result.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.result.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white px-3 py-1 text-[13px] text-slate-600 ring-1 ring-slate-200">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {state.result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
              {state.result.warnings.map((warning) => (
                <li key={warning}>・{warning}</li>
              ))}
            </ul>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <iframe
              key={state.result.previewUrl}
              src={state.result.previewUrl}
              className="h-[520px] w-full"
              title="テンプレートのプレビュー"
            />
          </div>

          <p className="text-[13px] text-slate-500">
            写真はすべて仮の画像です。編集画面で差し替えてください。確認が済んだら「販売可」に切り替えると、
            サイト作成時の自動選択の候補になります。
          </p>
        </div>
      )}
    </div>
  );
}
