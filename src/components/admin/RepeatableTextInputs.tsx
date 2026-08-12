"use client";

import { useState } from "react";
import { inputClass } from "./adminStyles";

/** A dynamic list of same-name text inputs (submitted as `formData.getAll(name)`), with add/remove
 * rows. Used where a form needs to collect a variable-length list of items in one submit. */
export function RepeatableTextInputs({ name, placeholder }: { name: string; placeholder: string }) {
  const [rowIds, setRowIds] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  return (
    <div className="flex flex-col gap-2">
      {rowIds.map((rowId) => (
        <div key={rowId} className="flex items-center gap-2">
          <input name={name} placeholder={placeholder} className={`${inputClass} flex-1`} />
          {rowIds.length > 1 && (
            <button
              type="button"
              onClick={() => setRowIds((rows) => rows.filter((id) => id !== rowId))}
              className="text-slate-300 hover:text-red-600"
              aria-label="この行を削除"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRowIds((rows) => [...rows, nextId]);
          setNextId((n) => n + 1);
        }}
        className="self-start text-[14px] text-slate-500 underline underline-offset-4 hover:text-slate-900"
      >
        + もう1件追加
      </button>
    </div>
  );
}
