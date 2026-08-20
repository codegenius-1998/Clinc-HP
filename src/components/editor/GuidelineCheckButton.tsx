"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { checkGuidelineComplianceAction } from "@/lib/site/editorActions";
import type { GuidelineCheckResult, GuidelineIssue } from "@/lib/openai/checkGuidelineCompliance";
import type { SiteDocument } from "@/lib/site/document";

/** Toolbar button + modal for the individual-clinic medical-advertising guideline check. Runs against
 * whatever is in the editor right now (including unsaved edits) so a problem can be caught and fixed
 * before it's ever saved or published, not after. */

const SEVERITY_STYLE: Record<GuidelineIssue["severity"], { label: string; className: string }> = {
  high: { label: "要修正", className: "bg-red-100 text-red-700" },
  medium: { label: "要確認", className: "bg-amber-100 text-amber-700" },
  low: { label: "改善余地", className: "bg-slate-100 text-slate-600" },
};

function IssueCard({ issue }: { issue: GuidelineIssue }) {
  const severity = SEVERITY_STYLE[issue.severity];
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-slate-500">{issue.location}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${severity.className}`}>
          {severity.label}
        </span>
      </div>
      <blockquote className="whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
        {issue.quote}
      </blockquote>
      <p className="text-[13px] leading-relaxed text-slate-600">{issue.reason}</p>
      <p className="text-[13px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">改善案：</span>
        {issue.suggestion}
      </p>
    </div>
  );
}

export function GuidelineCheckButton({ doc, documentId }: { doc: SiteDocument; documentId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GuidelineCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The toolbar this button lives in uses `backdrop-blur`, which — per the CSS containing-block rules
  // — makes it a containing block for `position: fixed` descendants, so a modal rendered in place here
  // would center itself against that thin toolbar strip instead of the viewport. Portalling to
  // `document.body` sidesteps that (and any future ancestor transform/filter) entirely. No extra
  // "mounted" flag is needed to guard `document`'s existence during SSR: `open` only ever flips to
  // true from the click handler below, never during a server render, so by the time the portal branch
  // runs we're always on the client.

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    const response = await checkGuidelineComplianceAction(documentId, doc);
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
        医療広告ガイドライン確認
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
                <h2 className="text-[14px] font-semibold text-slate-900">医療広告ガイドライン確認</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[13px] text-slate-400 hover:text-slate-900"
                >
                  閉じる
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {loading && <p className="text-[13px] text-slate-400">確認中…（AIが掲載文を読んでいます）</p>}

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
                  この確認はAIによる参考情報であり、法的な適合を保証するものではありません。最終的な判断は貴院の責任で行ってください。
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
