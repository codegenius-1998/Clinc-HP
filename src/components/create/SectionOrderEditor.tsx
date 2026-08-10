"use client";

import { useState } from "react";
import type { SiteSpecSection } from "@/lib/siteSpec";

type Row = { id: string; label: string; removable: boolean; visible: boolean };

function initialRows(sections: SiteSpecSection[]): Row[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, label: s.label, removable: s.removable, visible: s.defaultVisible }));
}

/** Lets the hearing screen operator directly control which body sections appear and in what order,
 * instead of leaving that entirely to the AI's generation-plan judgement call. Emits its current
 * state as parallel hidden inputs (`sectionId` / `sectionVisible` / `sectionOrder`, zipped by index —
 * the same convention `staffName`/`faqQuestion` already use) so it needs no server-side JS parsing
 * beyond what `createHearingAction` already does for those. */
export function SectionOrderEditor({ sections }: { sections: SiteSpecSection[] }) {
  const [rows, setRows] = useState<Row[]>(() => initialRows(sections));
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function move(index: number, delta: number) {
    setRows((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleVisible(index: number) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, visible: !row.visible } : row)));
  }

  function reorderTo(from: number, to: number) {
    if (from === to) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  if (rows.length === 0) return null;

  return (
    <div>
      <p className="text-[13px] font-medium text-slate-700">セクション構成</p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
        表示するセクションと並び順を指定できます。ドラッグ、または上下ボタンで並び替えてください。チェックを外すと、そのセクションは生成されるサイトに表示されません。
      </p>

      <ul className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) reorderTo(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 ${
              dragIndex === index ? "opacity-50" : ""
            }`}
          >
            <span aria-hidden className="cursor-grab select-none text-slate-300">
              ⠿
            </span>

            {row.removable ? (
              <input
                type="checkbox"
                checked={row.visible}
                onChange={() => toggleVisible(index)}
                className="h-4 w-4 shrink-0 text-sky-600 focus:ring-0"
              />
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">常に表示</span>
            )}

            <span className={`flex-1 ${row.visible ? "" : "text-slate-400 line-through"}`}>{row.label}</span>

            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`${row.label}を上へ`}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={`${row.label}を下へ`}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>

      {rows.map((row, index) => (
        <span key={row.id}>
          <input type="hidden" name="sectionId" value={row.id} />
          <input type="hidden" name="sectionVisible" value={row.visible ? "true" : "false"} />
          <input type="hidden" name="sectionOrder" value={index} />
        </span>
      ))}
    </div>
  );
}
