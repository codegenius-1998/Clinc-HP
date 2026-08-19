"use client";

import { useState } from "react";
import { BLOCK_DEFINITIONS, blockSummary } from "@/lib/site/blocks";
import type { Block } from "@/lib/site/document";

/** The page's block order, as a reorderable list.
 *
 * Drag-and-drop is the browser's own HTML5 drag API rather than a library: this is a single vertical
 * list in an admin tool, and a dependency would buy little. The ↑↓ buttons are not a fallback for
 * older browsers — they are how this stays usable with a keyboard and on touch, where HTML5 drag
 * does not fire at all. */
export function BlockList({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onToggleVisible,
  onDelete,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function finishDrag(to: number) {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {blocks.map((block, index) => {
        const definition = BLOCK_DEFINITIONS[block.type];
        const selected = block.id === selectedId;
        return (
          <li
            key={block.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              finishDrag(index);
            }}
            className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
              selected ? "border-slate-900 bg-slate-900/[0.04]" : "border-slate-200 bg-white hover:border-slate-300"
            } ${overIndex === index && dragIndex !== null && dragIndex !== index ? "border-sky-400 bg-sky-50" : ""} ${
              dragIndex === index ? "opacity-40" : ""
            }`}
          >
            <span
              aria-hidden
              title="ドラッグして並べ替え"
              className="cursor-grab select-none px-0.5 text-[15px] leading-none text-slate-300 active:cursor-grabbing"
            >
              ⠿
            </span>

            <button
              type="button"
              onClick={() => onSelect(block.id)}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <span className={`truncate text-[13px] ${block.visible ? "text-slate-800" : "text-slate-400 line-through"}`}>
                {definition.icon} {blockSummary(block)}
              </span>
              <span className="truncate text-[11px] text-slate-400">{definition.label}</span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => onReorder(index, index - 1)}
                disabled={index === 0}
                aria-label="上へ移動"
                className="rounded px-1 text-[12px] text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-0"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onReorder(index, index + 1)}
                disabled={index === blocks.length - 1}
                aria-label="下へ移動"
                className="rounded px-1 text-[12px] text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-0"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onToggleVisible(block.id)}
                aria-label={block.visible ? "非表示にする" : "表示する"}
                title={block.visible ? "非表示にする" : "表示する"}
                className="rounded px-1 text-[13px] hover:bg-slate-100"
              >
                {block.visible ? "👁" : "🚫"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`「${definition.label}」ブロックを削除しますか？`)) onDelete(block.id);
                }}
                aria-label="削除"
                title="削除"
                className="rounded px-1 text-[12px] text-slate-300 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
