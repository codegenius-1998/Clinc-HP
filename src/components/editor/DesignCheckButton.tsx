"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { checkDesignAction } from "@/lib/site/editorActions";
import type { DesignCheckResult, DesignIssue } from "@/lib/site/designCheck";
import type { SiteDocument } from "@/lib/site/document";

/** Toolbar button + modal for the design check. Runs against whatever is in the editor right now,
 * unsaved edits included, so a problem is caught before it is saved or published.
 *
 * Unlike the guideline check next door, this makes no model call — it is instant and free, which is
 * why it can be pressed as often as the user likes. It also only covers the half of the check that
 * needs no browser; the measured-in-a-real-browser rules (horizontal scroll, actual overflow) live in
 * `npm run check:design`, since Playwright must not be a dependency of the running app. */

const SEVERITY_STYLE: Record<DesignIssue["severity"], { label: string; className: string }> = {
  high: { label: "要修正", className: "bg-red-100 text-red-700" },
  medium: { label: "要確認", className: "bg-amber-100 text-amber-700" },
  low: { label: "改善余地", className: "bg-slate-100 text-slate-600" },
};

function IssueCard({ issue }: { issue: DesignIssue }) {
  const severity = SEVERITY_STYLE[issue.severity];
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-slate-500">{issue.location}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${severity.className}`}>
          {severity.label}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-700">{issue.reason}</p>
      <p className="text-[13px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">直し方：</span>
        {issue.suggestion}
      </p>
    </div>
  );
}

export function DesignCheckButton({ doc, documentId }: { doc: SiteDocument; documentId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DesignCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Portalled to document.body for the same reason as GuidelineCheckButton: the toolbar uses
  // `backdrop-blur`, which makes it a containing block for `position: fixed` children.

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    const response = await checkDesignAction(documentId, doc);
    setLoading(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    setResult(response.result);
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
      >
        デザイン確認
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
                <h2 className="text-[14px] font-semibold text-slate-900">デザイン確認</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[13px] text-slate-400 hover:text-slate-900"
                >
                  閉じる
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {loading && <p className="text-[13px] text-slate-400">確認中…</p>}

                {!loading && error && (
                  <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                    {error}
                  </p>
                )}

                {!loading && !error && result && (
                  <div className="flex flex-col gap-3">
                    <p
                      className={`rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${
                        result.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {result.summary}
                    </p>
                    {result.issues.map((issue, i) => (
                      <IssueCard key={i} issue={issue} />
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-slate-100 px-5 py-3">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  ここで見ているのは、保存済みのファイルと現在の編集内容です。実際の画面幅で測る確認（横スクロール・はみ出し）は
                  <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">npm run check:design</code>
                  で行えます。
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
