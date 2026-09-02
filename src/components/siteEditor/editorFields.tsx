"use client";

import { useId, useState } from "react";

/** Small controlled form primitives shared by the generated-site editor. Plain Tailwind, matching
 * the admin dashboard's slate palette. */

const inputBase =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? `${inputBase} font-mono` : inputBase}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} resize-y leading-relaxed`}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        aria-label={label}
      />
      <span className="w-20 shrink-0 text-[12px] text-slate-600 sm:w-28">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} min-w-0 font-mono`}
      />
    </label>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums text-slate-700">{format(value)}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-800"
      />
    </label>
  );
}

/** Editable list of short strings (bubbles, conditions, access points, …). */
export function StringListField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, ""]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={item}
            placeholder={placeholder}
            onChange={(e) => set(i, e.target.value)}
            className={inputBase}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 rounded p-2 text-[13px] text-slate-400 hover:bg-slate-100 hover:text-red-600"
            aria-label="削除"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        ＋ 追加
      </button>
    </div>
  );
}

/** One image slot: preview + URL field + upload + optional AI generate. */
export function ImageField({
  label,
  src,
  onChange,
  slug,
  aiKind,
  aiHint,
}: {
  label: string;
  src: string | null;
  onChange: (url: string | null) => void;
  slug: string;
  aiKind?: "portrait" | "interior" | "exterior";
  aiHint?: string;
}) {
  const [busy, setBusy] = useState<null | "upload" | "ai">(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy("upload");
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("category", "generated");
      fd.append("files", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok || !json.urls?.[0]) throw new Error(json.error || "アップロードに失敗しました。");
      onChange(json.urls[0]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "アップロードに失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!aiKind) return;
    setBusy("ai");
    setErr(null);
    try {
      const { generateImageAction } = await import("@/lib/contentActions");
      const r = await generateImageAction(slug, aiKind, aiHint || "");
      if (!r.ok) throw new Error(r.error);
      onChange(r.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "画像生成に失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex gap-2.5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-[10px] text-slate-400">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            "なし"
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            type="text"
            value={src ?? ""}
            placeholder="画像URL（空でプレースホルダ）"
            onChange={(e) => onChange(e.target.value.trim() || null)}
            className={inputBase}
          />
          <div className="flex flex-wrap gap-1.5">
            <label className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-50">
              {busy === "upload" ? "アップロード中…" : "アップロード"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {aiKind && (
              <button
                type="button"
                onClick={generate}
                disabled={busy !== null}
                className="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "ai" ? "生成中… (最大60秒)" : "AIで生成"}
              </button>
            )}
          </div>
        </div>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </div>
  );
}

export function Group({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 text-[13px] font-semibold text-slate-800 marker:text-slate-400 hover:bg-slate-50">
        {title}
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3">{children}</div>
    </details>
  );
}
