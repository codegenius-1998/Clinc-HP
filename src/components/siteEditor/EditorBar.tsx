"use client";

import Link from "next/link";
import { useEffect } from "react";

/** The sticky toolbar shared by the editor overview and the per-section pages: back link, title,
 * open-preview, save. Warns before leaving with unsaved changes. */
export function EditorBar({
  backHref,
  backLabel,
  title,
  previewUrl,
  dirty,
  saving,
  onSave,
  message,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  previewUrl: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  message: { kind: "ok" | "err"; text: string } | null;
}) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="sticky top-0 z-20 mb-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link
            href={backHref}
            onClick={(e) => {
              if (dirty && !window.confirm("未保存の変更があります。移動してよいですか？")) e.preventDefault();
            }}
            className="text-[12px] text-slate-500 hover:text-slate-800"
          >
            ← {backLabel}
          </Link>
          <h1 className="truncate text-[15px] font-semibold text-slate-900 sm:text-[17px]">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={previewUrl}
            target="clinic-site-preview"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50"
          >
            プレビュー ↗
          </a>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? "保存中…" : dirty ? "保存" : "保存済み"}
          </button>
        </div>
      </div>
      {message && (
        <p
          className={`mt-2 rounded-md px-3 py-2 text-[13px] ${
            message.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
      {dirty && !message && (
        <p className="mt-2 text-[12px] text-amber-600">
          未保存の変更があります。「保存」後に「プレビュー」タブを再読み込みで反映されます。
        </p>
      )}
    </div>
  );
}
