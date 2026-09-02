"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SiteTemplate, CustomBlockKind } from "@/lib/generatedSite/types";
import { FONT_NAMES, fontStack, googleHref, parseFamily } from "@/lib/generatedSite/fonts";
import { saveGeneratedTemplateAction } from "@/lib/contentActions";
import { ColorField, RangeField, SelectField, Group } from "./editorFields";
import { EditorBar } from "./EditorBar";
import {
  ALL_SECTIONS,
  COLOR_KEYS,
  CUSTOM_KIND_HINT,
  CUSTOM_KIND_LABEL,
  SECTION_LABELS,
  WASH_KEYS,
  newCustomBlock,
  sectionTitle,
} from "./shared";

/** Editor overview: theme (colours / fonts) + the section list. Editing a section's *content*
 * happens on its own page — tapping a section row navigates there (saving first if needed so a
 * pending reorder / theme change is never lost). */
export function SiteEditorOverview({
  slug,
  clinicName,
  initialTemplate,
  initialUrl,
  backHref,
  backLabel,
  editBase,
}: {
  slug: string;
  clinicName: string;
  initialTemplate: SiteTemplate;
  initialUrl: string;
  backHref: string;
  backLabel: string;
  /** e.g. `/admin/requests/<slug>/edit` — section pages live at `${editBase}/${sectionId}`. */
  editBase: string;
}) {
  const router = useRouter();
  const seed: SiteTemplate = { ...initialTemplate, customBlocks: initialTemplate.customBlocks ?? [] };
  const [template, setTemplate] = useState<SiteTemplate>(seed);
  const [baseline, setBaseline] = useState(() => JSON.stringify(seed));
  const dirty = JSON.stringify(template) !== baseline;

  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // --- theme setters ---
  const setColor = (key: keyof SiteTemplate["theme"]["colors"], v: string) =>
    setTemplate((t) => ({ ...t, theme: { ...t.theme, colors: { ...t.theme.colors, [key]: v } } }));
  const setWash = (key: keyof SiteTemplate["theme"]["washes"], v: string) =>
    setTemplate((t) => ({ ...t, theme: { ...t.theme, washes: { ...t.theme.washes, [key]: v } } }));
  const setFont = (which: "heading" | "body", family: string) =>
    setTemplate((t) => {
      const h = which === "heading" ? family : parseFamily(t.theme.fonts.heading);
      const b = which === "body" ? family : parseFamily(t.theme.fonts.body);
      return {
        ...t,
        theme: {
          ...t.theme,
          fonts: { ...t.theme.fonts, heading: fontStack(h), body: fontStack(b), googleHref: googleHref(h, b) },
        },
      };
    });
  const setScale = (v: number) => setTemplate((t) => ({ ...t, theme: { ...t.theme, fontScale: v } }));

  // --- layout ops ---
  const moveSection = (i: number, dir: -1 | 1) =>
    setTemplate((t) => {
      const next = [...t.layout];
      const j = i + dir;
      if (j < 0 || j >= next.length) return t;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...t, layout: next };
    });
  const removeSection = (id: string) => {
    if (!window.confirm(`「${sectionTitle(template, id)}」を削除しますか？`)) return;
    setTemplate((t) => ({
      ...t,
      layout: t.layout.filter((l) => l.id !== id),
      nav: t.nav.filter((n) => n.href !== `#${id}`),
      customBlocks: t.customBlocks.filter((b) => b.id !== id),
    }));
  };
  const addSection = (id: string) =>
    setTemplate((t) => (t.layout.some((l) => l.id === id) ? t : { ...t, layout: [...t.layout, { id, kind: id }] }));
  const addCustomBlock = (kind: CustomBlockKind) =>
    setTemplate((t) => {
      let n = 1;
      let id = `${kind}-${n}`;
      const taken = new Set([...t.layout.map((l) => l.id), ...t.customBlocks.map((b) => b.id)]);
      while (taken.has(id)) id = `${kind}-${++n}`;
      return { ...t, customBlocks: [...t.customBlocks, newCustomBlock(kind, id)], layout: [...t.layout, { id, kind }] };
    });

  const missing = ALL_SECTIONS.filter((id) => !template.layout.some((l) => l.id === id));

  // --- save ---
  function doSave(): Promise<boolean> {
    return new Promise((resolve) => {
      startSaving(async () => {
        setMessage(null);
        const r = await saveGeneratedTemplateAction(slug, template);
        if (r.ok) {
          setBaseline(JSON.stringify(template));
          setMessage({ kind: "ok", text: "保存しました。" });
          resolve(true);
        } else {
          setMessage({ kind: "err", text: r.error });
          resolve(false);
        }
      });
    });
  }

  async function openSection(id: string) {
    if (dirty && !(await doSave())) return;
    router.push(`${editBase}/${encodeURIComponent(id)}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <EditorBar
        backHref={backHref}
        backLabel={backLabel}
        title={`${clinicName}／サイト編集`}
        previewUrl={initialUrl}
        dirty={dirty}
        saving={saving}
        onSave={doSave}
        message={message}
      />

      <div className="flex flex-col gap-3">
        <Group title="テーマ — 色" open>
          <p className="text-[12px] text-slate-500">
            色が薄すぎると本文やボタンが読みにくくなります。保存時に自動で最低限のコントラストまで濃くします。
          </p>
          {COLOR_KEYS.map(([key, label]) => (
            <ColorField key={key} label={label} value={template.theme.colors[key]} onChange={(v) => setColor(key, v)} />
          ))}
          <details className="mt-1">
            <summary className="cursor-pointer text-[12px] text-slate-500">水彩のにじみ色（装飾）</summary>
            <div className="mt-2 flex flex-col gap-2">
              {WASH_KEYS.map(([key, label]) => (
                <ColorField key={key} label={label} value={template.theme.washes[key]} onChange={(v) => setWash(key, v)} />
              ))}
            </div>
          </details>
        </Group>

        <Group title="テーマ — 文字" open>
          <SelectField
            label="見出しの書体"
            value={parseFamily(template.theme.fonts.heading)}
            options={FONT_NAMES.map((n) => ({ value: n, label: n }))}
            onChange={(v) => setFont("heading", v)}
          />
          <SelectField
            label="本文の書体"
            value={parseFamily(template.theme.fonts.body)}
            options={FONT_NAMES.map((n) => ({ value: n, label: n }))}
            onChange={(v) => setFont("body", v)}
          />
          <RangeField
            label="文字サイズ（全体）"
            value={template.theme.fontScale ?? 1}
            min={0.9}
            max={1.15}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setScale}
          />
        </Group>

        <Group title="セクション構成（並び順・追加・削除）" open>
          <p className="text-[12px] text-slate-500">
            セクション名を押すと、その内容の編集ページに移動します（未保存の変更は先に保存します）。
          </p>
          <ol className="flex flex-col gap-1.5">
            {template.layout.map((l, i) => (
              <li
                key={l.id}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white py-1 pl-1 pr-1 text-[13px]"
              >
                <button
                  type="button"
                  onClick={() => openSection(l.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-left hover:bg-slate-50"
                >
                  <span className="tabular-nums text-slate-400">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{sectionTitle(template, l.id)}</span>
                  <span className="shrink-0 text-slate-400">編集 ›</span>
                </button>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="上へ"
                    disabled={i === 0}
                    onClick={() => moveSection(i, -1)}
                    className="rounded p-2 text-[15px] leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="下へ"
                    disabled={i === template.layout.length - 1}
                    onClick={() => moveSection(i, 1)}
                    className="rounded p-2 text-[15px] leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  {l.id !== "hero" && l.id !== "contact" && (
                    <button
                      type="button"
                      aria-label="このセクションを削除"
                      onClick={() => removeSection(l.id)}
                      className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      削除
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {missing.length > 0 && (
            <SelectField
              label="決まったセクションを戻す"
              value=""
              options={[
                { value: "", label: "— 選択 —" },
                ...missing.map((id) => ({ value: id, label: SECTION_LABELS[id] ?? id })),
              ]}
              onChange={(v) => v && addSection(v)}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">自由なセクションを追加</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CUSTOM_KIND_LABEL) as CustomBlockKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addCustomBlock(kind)}
                  title={CUSTOM_KIND_HINT[kind]}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  ＋ {CUSTOM_KIND_LABEL[kind]}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              追加すると一覧の最後に入ります。名前を押して内容を編集してください。
            </p>
          </div>
        </Group>

        <p className="py-4 text-center text-[12px] text-slate-400">
          並び順・追加・削除・テーマの変更は「保存」で反映されます。表示は「プレビュー ↗」（別タブ）で確認できます。
        </p>
      </div>
    </div>
  );
}
