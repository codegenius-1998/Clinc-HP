"use client";

import { useState } from "react";
import { BLOCK_PALETTE, createBlock } from "@/lib/site/blocks";
import type { Block, BlockType } from "@/lib/site/document";

/** The "add a block" menu. Block TYPES are a fixed catalog (see src/lib/site/blocks.ts); what's free
 * is how many of each a page has and in what order — so this list never changes, but a page can hold
 * three 文章＋カード blocks if that is what the clinic needs.
 *
 * Types marked `singleton` in the registry are the ones a page can only sensibly have one of (a
 * second hero, a second お問い合わせ). They're shown greyed out rather than hidden so it's clear the
 * block exists and is already in use. */
export function AddBlockPalette({ blocks, onAdd }: { blocks: Block[]; onAdd: (block: Block) => void }) {
  const [open, setOpen] = useState(false);
  const used = new Set<BlockType>(blocks.map((b) => b.type));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-[13px] text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50"
      >
        ＋ ブロックを追加
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-medium text-slate-500">追加するブロックを選ぶ</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-slate-400 hover:text-slate-700">
          閉じる
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {BLOCK_PALETTE.map((definition) => {
          const blocked = definition.singleton && used.has(definition.type);
          return (
            <li key={definition.type}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => {
                  onAdd(createBlock(definition.type));
                  setOpen(false);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="text-[13px] text-slate-800">
                  {definition.icon} {definition.label}
                  {blocked && <span className="ml-1 text-[11px] text-slate-400">（追加済み）</span>}
                </span>
                <span className="block text-[11px] leading-snug text-slate-400">{definition.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
