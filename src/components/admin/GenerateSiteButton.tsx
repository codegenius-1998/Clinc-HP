"use client";

import { useState, useTransition } from "react";
import { generateSiteAction } from "@/lib/contentActions";

/** "サイト生成" control on /admin/requests. Calls the synchronous OpenAI-backed generator (tens of
 * seconds) and shows progress / result inline. `previewUrl` is passed when a site already exists. */
export function GenerateSiteButton({
  slug,
  previewUrl,
}: {
  slug: string;
  previewUrl?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(previewUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  function run() {
    setError(null);
    setWarnings([]);
    startTransition(async () => {
      const result = await generateSiteAction(slug);
      if (result.ok) {
        setUrl(result.url);
        setWarnings(result.warnings);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {url && !pending && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline underline-offset-4 hover:text-blue-500"
          >
            プレビュー
          </a>
        )}
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "生成中… (30〜90秒)" : url ? "再生成" : "サイト生成"}
        </button>
      </div>
      {error && <p className="max-w-xs text-right text-[12px] text-red-600">{error}</p>}
      {warnings.map((w, i) => (
        <p key={i} className="max-w-xs text-right text-[12px] text-amber-600">
          {w}
        </p>
      ))}
    </div>
  );
}
