"use client";

import { useId, useState } from "react";
import { adoptImageAction } from "@/lib/site/editorActions";

/** Shared inputs for the editor. Everything the editor can edit is one of these four shapes, which
 * is what lets BlockEditor build a whole block's form from the registry in src/lib/site/blocks.ts
 * without knowing anything about the block. */

export const fieldInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-1 focus:ring-slate-100";

export function FieldShell({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-500">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldInputClass} resize-y leading-relaxed`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={fieldInputClass}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
        />
        <span className="w-16 shrink-0 text-right font-mono text-[13px] text-slate-600">
          {value}
          {unit}
        </span>
      </div>
    </FieldShell>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldInputClass} font-mono`}
        />
      </div>
    </FieldShell>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900"
      />
      <span>
        <span className="text-[13px] font-medium text-slate-600">{label}</span>
        {hint && <span className="block text-[12px] text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

/** Resolves a stored image reference for display inside the editor. Blocks store SITE-relative paths
 * ("images/hero.jpg") because the published site must be self-contained, but the editor renders from
 * a different URL, so it needs the site's asset base prefixed back on. */
export function resolveImageSrc(value: string, assetBase: string): string {
  if (!value) return "";
  if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("/")) return value;
  return `${assetBase}${value}`;
}

export function ImageField({
  label,
  value,
  documentId,
  assetBase,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  documentId: string;
  assetBase: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      // Two hops on purpose: the browser uploads to Supabase Storage via /api/uploads (Server Actions
      // cap request bodies at 1MB, far too small for a real photo), then the server copies the object
      // into the site's own directory so the published site carries its own images.
      const body = new FormData();
      body.append("category", "editor");
      body.append("files", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const result = (await response.json()) as { urls?: string[]; error?: string };
      if (!response.ok || !result.urls?.[0]) {
        setError(result.error ?? "アップロードに失敗しました。");
        return;
      }

      const adopted = await adoptImageAction(documentId, result.urls[0]);
      if (adopted.error || !adopted.path) {
        setError(adopted.error ?? "画像の取り込みに失敗しました。");
        return;
      }
      onChange(adopted.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  const src = resolveImageSrc(value, assetBase);

  return (
    <FieldShell label={label} hint={hint}>
      <div className="flex items-start gap-3">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail of a file that
            // lives in public/generated, outside Next's image pipeline
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] text-slate-400">なし</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            id={id}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
            className="block w-full text-[13px] text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-[13px] file:text-white hover:file:bg-slate-700 disabled:opacity-50"
          />
          {busy && <p className="text-[12px] text-slate-400">アップロード中…</p>}
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="self-start text-[12px] text-slate-400 underline underline-offset-4 hover:text-red-600"
            >
              画像を外す
            </button>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
      </div>
    </FieldShell>
  );
}
