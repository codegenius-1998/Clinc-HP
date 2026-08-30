"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { SiteTemplate } from "@/lib/generatedSite/types";
import { renderBundle } from "@/lib/generatedSite/render";
import { FONT_NAMES, fontStack, googleHref, parseFamily } from "@/lib/generatedSite/fonts";
import { saveGeneratedTemplateAction, regenerateSectionAction } from "@/lib/contentActions";
import { ColorField, RangeField, SelectField, Group } from "./editorFields";
import { SectionFields } from "./SectionFields";

const SECTION_LABELS: Record<string, string> = {
  hero: "ファーストビュー",
  greeting: "当院について",
  medical: "診療案内",
  philosophy: "当院の想い",
  gallery: "院内のようす",
  schedule: "診療時間",
  fees: "料金の目安",
  flow: "受診の流れ",
  faq: "よくあるご質問",
  news: "お知らせ",
  access: "アクセス",
  contact: "お問い合わせ",
};
const ALL_SECTIONS = Object.keys(SECTION_LABELS);
const REGENERATABLE = new Set([
  "hero", "greeting", "medical", "philosophy", "gallery", "faq", "flow", "contact",
]);

const COLOR_KEYS: [keyof SiteTemplate["theme"]["colors"], string][] = [
  ["primary", "プライマリ"],
  ["primaryDeep", "プライマリ（濃）"],
  ["accent", "アクセント"],
  ["tint", "淡色の地"],
  ["paper", "背景（紙）"],
  ["ink", "本文"],
  ["inkSoft", "本文（淡）"],
  ["line", "罫線"],
];
const WASH_KEYS: [keyof SiteTemplate["theme"]["washes"], string][] = [
  ["pink", "ピンク"],
  ["blue", "ブルー"],
  ["yellow", "イエロー"],
  ["peach", "ピーチ"],
  ["mint", "ミント"],
];

export function SiteEditor({
  slug,
  clinicName,
  initialTemplate,
  initialUrl,
  backHref = "/admin/requests",
  backLabel = "リクエスト一覧",
}: {
  slug: string;
  clinicName: string;
  initialTemplate: SiteTemplate;
  initialUrl: string;
  backHref?: string;
  backLabel?: string;
}) {
  const [template, setTemplate] = useState<SiteTemplate>(initialTemplate);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialTemplate));
  const dirty = JSON.stringify(template) !== baseline;

  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);

  // --- live preview (debounced so typing doesn't thrash the iframe) ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const html = useMemo(() => {
    try {
      const doc = renderBundle(template)["index.html"];
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return doc.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<base href="${origin}/api/generated/${slug}/">`);
    } catch {
      return "<p style=\"font-family:sans-serif;padding:2rem\">プレビューを描画できませんでした。</p>";
    }
  }, [template, slug]);
  useEffect(() => {
    const t = setTimeout(() => setSrcDoc(html), 250);
    return () => clearTimeout(t);
  }, [html]);

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
          fonts: {
            ...t.theme.fonts,
            heading: fontStack(h),
            body: fontStack(b),
            googleHref: googleHref(h, b),
          },
        },
      };
    });
  const setScale = (v: number) =>
    setTemplate((t) => ({ ...t, theme: { ...t.theme, fontScale: v } }));

  // --- layout ops ---
  const moveSection = (i: number, dir: -1 | 1) =>
    setTemplate((t) => {
      const next = [...t.layout];
      const j = i + dir;
      if (j < 0 || j >= next.length) return t;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...t, layout: next };
    });
  const removeSection = (id: string) =>
    setTemplate((t) => ({
      ...t,
      layout: t.layout.filter((l) => l.id !== id),
      nav: t.nav.filter((n) => n.href !== `#${id}`),
    }));
  const addSection = (id: string) =>
    setTemplate((t) =>
      t.layout.some((l) => l.id === id) ? t : { ...t, layout: [...t.layout, { id, kind: id }] }
    );

  const missing = ALL_SECTIONS.filter((id) => !template.layout.some((l) => l.id === id));

  // --- actions ---
  const save = () =>
    startSaving(async () => {
      setMessage(null);
      const r = await saveGeneratedTemplateAction(slug, template);
      if (r.ok) {
        setBaseline(JSON.stringify(template));
        setMessage({ kind: "ok", text: "保存しました。プレビューに反映されています。" });
        iframeRef.current?.contentWindow?.location.reload();
      } else {
        setMessage({ kind: "err", text: r.error });
      }
    });

  const regenerate = useCallback(
    async (id: string) => {
      setRegenId(id);
      setMessage(null);
      try {
        const r = await regenerateSectionAction(slug, id, template);
        if (r.ok) setTemplate(r.template);
        else setMessage({ kind: "err", text: r.error });
      } finally {
        setRegenId(null);
      }
    },
    [slug, template]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="text-[13px] text-slate-500 hover:text-slate-800">
            ← {backLabel}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{clinicName}／サイト編集</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={initialUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-blue-600 underline underline-offset-4 hover:text-blue-500"
          >
            別タブでプレビュー
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? "保存中…" : dirty ? "保存して再レンダリング" : "保存済み"}
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-[13px] ${
            message.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* form */}
        <div className="flex max-h-[calc(100vh-11rem)] flex-col gap-3 overflow-y-auto pr-1">
          <Group title="テーマ — 色" open>
            {COLOR_KEYS.map(([key, label]) => (
              <ColorField key={key} label={label} value={template.theme.colors[key]} onChange={(v) => setColor(key, v)} />
            ))}
            <details className="mt-1">
              <summary className="cursor-pointer text-[12px] text-slate-500">水彩のにじみ色</summary>
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

          <Group title="セクション構成" open>
            <ul className="flex flex-col gap-1">
              {template.layout.map((l, i) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-[13px]"
                >
                  <span className="text-slate-800">{SECTION_LABELS[l.id] ?? l.id}</span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="上へ"
                      disabled={i === 0}
                      onClick={() => moveSection(i, -1)}
                      className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="下へ"
                      disabled={i === template.layout.length - 1}
                      onClick={() => moveSection(i, 1)}
                      className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    {l.id !== "hero" && l.id !== "contact" && (
                      <button
                        type="button"
                        onClick={() => removeSection(l.id)}
                        className="rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      >
                        削除
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {missing.length > 0 && (
              <SelectField
                label="セクションを追加"
                value=""
                options={[{ value: "", label: "— 選択 —" }, ...missing.map((id) => ({ value: id, label: SECTION_LABELS[id] ?? id }))]}
                onChange={(v) => v && addSection(v)}
              />
            )}
          </Group>

          {template.layout.map((l) => (
            <Group key={l.id} title={SECTION_LABELS[l.id] ?? l.id}>
              <SectionFields id={l.id} template={template} onChange={setTemplate} slug={slug} />
              {REGENERATABLE.has(l.id) && (
                <button
                  type="button"
                  onClick={() => regenerate(l.id)}
                  disabled={regenId !== null}
                  className="mt-1 self-start rounded-md border border-slate-300 px-2.5 py-1 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {regenId === l.id ? "AIで書き直し中…" : "このセクションの文章をAIで再生成"}
                </button>
              )}
            </Group>
          ))}
        </div>

        {/* preview */}
        <div className="lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-500">
              <span>プレビュー（自動更新）</span>
              {dirty && <span className="text-amber-600">未保存の変更あり</span>}
            </div>
            <iframe
              ref={iframeRef}
              title="サイトプレビュー"
              srcDoc={srcDoc}
              className="h-[calc(100vh-13rem)] w-full bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
