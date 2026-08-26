"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  countTemplateImagesAction,
  illustrateTemplateAction,
  templateImageStatusAction,
} from "@/lib/template/templateActions";

/** 「写真を作る」 — fills a template's remaining placeholder images.
 *
 * ⚠️ Two clicks, on purpose. This is the only button in the admin that spends money per press, and
 * how much depends on a number nobody can see from the list (how many image slots this particular
 * template's blocks add up to). The first click loads that number, the second one commits to it.
 * A one-click button here would be a bill of unknown size.
 *
 * ⚠️ The count is not rendered with the page. Working it out needs the template's blocks, and the
 * list page has only summaries — fetching every template's blocks to label a button nobody may press
 * would be one D1 round trip per row on every page load. */
export function IllustrateTemplateButton({ templateId, name }: { templateId: string; name: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "counting" | "confirm" | "running" | "done">("idle");
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  async function count() {
    setState("counting");
    setError(null);
    try {
      const result = await countTemplateImagesAction(templateId);
      setTotal(result.total);
      setRemaining(result.remaining);
      setState(result.remaining === 0 ? "done" : "confirm");
    } catch {
      setError("枚数を数えられませんでした。");
      setState("idle");
    }
  }

  async function start() {
    setState("running");
    setError(null);
    try {
      const { started } = await illustrateTemplateAction(templateId);
      if (!started) {
        setError("いま生成中です。しばらくお待ちください。");
      }
      // Generation runs past the response, so progress is polled rather than awaited. The interval
      // is slow because each picture takes several seconds — a fast poll would only add load.
      timer.current = setInterval(async () => {
        const status = await templateImageStatusAction(templateId).catch(() => null);
        if (!status) return;
        setRemaining(status.remaining);
        if (status.running) return;
        if (timer.current) clearInterval(timer.current);
        setState("done");
        router.refresh();
      }, 5000);
    } catch {
      setError("写真の生成を開始できませんでした。");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[14px] text-emerald-700">
        {remaining === 0 ? "写真はそろっています" : `残り${remaining}枚`}
      </span>
    );
  }

  if (state === "confirm") {
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={start}
          className="rounded-lg bg-slate-900 px-3 py-2 text-[14px] text-white transition-colors hover:bg-slate-700"
          title={`${name}: ${total}か所のうち${remaining}か所が未生成です`}
        >
          {remaining}枚を作る（課金あり）
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-500 transition-colors hover:bg-slate-50"
        >
          やめる
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={count}
        disabled={state !== "idle"}
        className="rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {state === "counting" ? "数えています…" : state === "running" ? `生成中… 残り${remaining}枚` : "写真を作る"}
      </button>
      {error && <span className="text-[13px] text-rose-600">{error}</span>}
    </span>
  );
}
