"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importFromGeneratedSiteAction, type ImportState } from "@/lib/template/templateActions";
import type { GeneratedSiteCandidate } from "@/lib/template/importFromGeneratedSite";
import { inputClass } from "./adminStyles";

/** "Turn one of our own generated sites into a template." The design is read out of the page rather
 * than inferred, so this path is exact — and the source site's photos come along, which is why the
 * resulting template previews with real images instead of grey placeholders. */
export function GeneratedSiteImportForm({ sites }: { sites: GeneratedSiteCandidate[] }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importFromGeneratedSiteAction, {
    error: null,
    result: null,
  });
  const [selected, setSelected] = useState(sites[0]?.slug ?? "");

  if (sites.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[14px] text-slate-400">
        テンプレート化できる生成済みサイトがありません。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[14px] text-slate-500">元にするサイト</legend>
          {sites.map((site) => (
            <label
              key={site.slug}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                selected === site.slug ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="slug"
                value={site.slug}
                checked={selected === site.slug}
                onChange={() => setSelected(site.slug)}
                className="h-4 w-4 accent-slate-900"
              />
              <span
                aria-hidden
                className="h-6 w-6 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: site.primary }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-slate-900">{site.title}</span>
                <span className="block truncate text-[12px] text-slate-400">
                  {site.slug} ・ メインカラー {site.primary} ・ {site.heroLayout}
                </span>
              </span>
              <a
                href={`/generated/${site.slug}/index.html`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-[12px] text-slate-400 underline underline-offset-4 hover:text-slate-900"
              >
                表示
              </a>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="gen-name" className="text-[14px] text-slate-500">
            テンプレート名（任意）
          </label>
          <input id="gen-name" name="name" className={inputClass} placeholder="空欄の場合はAIが名前を付けます" />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "作成中…" : "このサイトからテンプレートを作る"}
        </button>

        {state.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{state.error}</p>
        )}
      </form>

      {state.result && (
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] text-emerald-700">テンプレートを作成しました</p>
              <p className="text-[18px] font-medium text-slate-900">{state.result.name}</p>
            </div>
            <Link
              href={`/admin/templates/${state.result.id}`}
              className="rounded-lg bg-slate-900 px-4 py-2 text-[14px] text-white transition-colors hover:bg-slate-700"
            >
              編集する
            </Link>
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <iframe key={state.result.previewUrl} src={state.result.previewUrl} className="h-[520px] w-full" title="テンプレートのプレビュー" />
          </div>
        </div>
      )}
    </div>
  );
}
