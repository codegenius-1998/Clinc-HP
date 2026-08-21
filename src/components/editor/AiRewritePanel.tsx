"use client";

import { useState } from "react";
import { rewriteBlockAction } from "@/lib/site/editorActions";
import { setFieldValue } from "@/lib/site/fieldPath";
import type { BlockRewrite } from "@/lib/openai/rewriteBlockText";
import type { Block } from "@/lib/site/document";

/** "このセクションをAIで書き直す" — shown only when a whole section is selected.
 *
 * Two deliberate limits, both because a model rewriting copy is the one part of this editor that can
 * silently make things worse:
 *   1. It rewrites ONE section, never the page. The before/after stays small enough to read.
 *   2. The result lands in the editor as an ordinary unsaved edit, and 元に戻す restores the exact
 *      pre-rewrite block from memory — so an unwanted rewrite costs one click, not a re-generation. */

const EXAMPLES = [
  "もっと親しみやすい、やさしい言葉づかいに",
  "落ち着いた、信頼感のある表現に",
  "文章を短くして、要点だけに",
  "小さなお子さん連れの保護者に向けた文章に",
];

export function AiRewritePanel({
  documentId,
  block,
  onChangeBlock,
}: {
  documentId: string;
  block: Block;
  onChangeBlock: (next: Block) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlockRewrite | null>(null);
  /** The block exactly as it was before the last applied rewrite. Holding the whole block (rather
   * than a list of reverse-edits) means 元に戻す is a plain assignment and cannot drift. */
  const [previous, setPrevious] = useState<Block | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    const response = await rewriteBlockAction(documentId, block, instruction);
    setRunning(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    const rewrite = response.result;
    if (!rewrite) return;
    setResult(rewrite);
    if (rewrite.edits.length === 0) return;

    setPrevious(block);
    let data = block.data as Record<string, unknown>;
    for (const edit of rewrite.edits) data = setFieldValue(data, edit.path, edit.after);
    onChangeBlock({ ...block, data } as Block);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div>
        <p className="text-[12px] font-medium text-violet-800">AIでこのセクションを書き直す</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-violet-700">
          このセクションの文章だけが対象です。他のセクションは変わりません。
        </p>
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="例）もっと親しみやすい言葉づかいに"
        className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-violet-400"
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setInstruction(example)}
            className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] text-violet-700 transition-colors hover:bg-violet-100"
          >
            {example}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={run}
        disabled={running || instruction.trim().length === 0}
        className="rounded-lg bg-violet-600 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
      >
        {running ? "書き直し中…" : "AIで書き直す"}
      </button>

      {error && (
        <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-white p-2.5">
          <p className="text-[12px] leading-relaxed text-slate-700">{result.note}</p>

          {result.edits.length === 0 ? (
            <p className="text-[12px] text-slate-400">変更はありませんでした。</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {result.edits.map((edit) => (
                  <li key={edit.path} className="text-[12px] leading-relaxed">
                    <p className="text-[11px] text-slate-400">{edit.label}</p>
                    <p className="mt-0.5 whitespace-pre-line text-slate-400 line-through">{edit.before}</p>
                    <p className="mt-0.5 whitespace-pre-line text-slate-900">{edit.after}</p>
                  </li>
                ))}
              </ul>
              {previous && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeBlock(previous);
                    setPrevious(null);
                    setResult(null);
                  }}
                  className="self-start text-[12px] text-slate-400 underline underline-offset-4 hover:text-slate-900"
                >
                  元に戻す
                </button>
              )}
              <p className="text-[11px] text-slate-400">保存するまで確定しません。</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
