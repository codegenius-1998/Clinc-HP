"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { publishDocumentAction, saveDocumentAction } from "@/lib/site/editorActions";
import { setFieldValue } from "@/lib/site/fieldPath";
import type { Block, SiteDocument } from "@/lib/site/document";
import { AddBlockPalette } from "./AddBlockPalette";
import { BlockEditor } from "./BlockEditor";
import { BlockList } from "./BlockList";
import { DesignPanel } from "./DesignPanel";
import { GuidelineCheckButton } from "./GuidelineCheckButton";
import { Inspector, type Selection } from "./Inspector";
import { MetaPanel } from "./MetaPanel";
import { VisualCanvas } from "./VisualCanvas";

/** The one editor, used for both design templates and generated clinic sites — they are the same
 * document shape, so there is nothing to specialise beyond hiding 公開 on a template.
 *
 * The whole document is held in local state and written in one go on 保存. That is deliberate:
 * reordering blocks, retitling them and rewriting their text are usually one edit in the user's head,
 * and a per-field autosave would fire a D1 write and a full re-render on every keystroke. The cost is
 * that unsaved work is real work, so leaving with changes pending is guarded below. */

type Tab = "blocks" | "design" | "meta";

const TABS: { id: Tab; label: string }[] = [
  { id: "blocks", label: "ブロック" },
  { id: "design", label: "デザイン" },
  { id: "meta", label: "基本情報・SEO" },
];

export function SiteEditor({
  initialDocument,
  previewUrl,
  backHref,
  backLabel,
}: {
  initialDocument: SiteDocument;
  previewUrl: string;
  backHref: string;
  backLabel: string;
}) {
  const [doc, setDoc] = useState<SiteDocument>(initialDocument);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("blocks");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Separate from `selectedId` (which block is open in the left sidebar's form) — this is what was
  // last clicked directly on the canvas, addressed down to the individual field.
  const [canvasSelection, setCanvasSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(initialDocument.updatedAt);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const assetBase = useMemo(() => previewUrl.replace(/index\.html$/, ""), [previewUrl]);
  const selected = doc.blocks.find((b) => b.id === selectedId) ?? null;

  const update = useCallback((next: (current: SiteDocument) => SiteDocument) => {
    setDoc((current) => next(current));
    setDirty(true);
  }, []);

  // A reload or a stray back-navigation would silently discard everything typed since the last save.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function reorder(from: number, to: number) {
    if (to < 0 || to >= doc.blocks.length || from === to) return;
    update((current) => {
      const blocks = [...current.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...current, blocks };
    });
  }

  function replaceBlock(next: Block) {
    update((current) => ({
      ...current,
      blocks: current.blocks.map((b) => (b.id === next.id ? next : b)),
    }));
  }

  /** Commits an in-place canvas edit (VisualCanvas's `onTextEdit`) into `doc.blocks` by field path —
   * the same state update BlockEditor's form fields go through, just addressed by path instead of a
   * form's own local key, so the two editing surfaces can never disagree about what's stored. */
  function handleCanvasTextEdit(edit: Selection & { value: string }) {
    const block = doc.blocks.find((b) => b.id === edit.blockId);
    if (!block) return;
    replaceBlock({ ...block, data: setFieldValue(block.data, edit.fieldPath, edit.value) } as Block);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveDocumentAction(doc.id, doc);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDirty(false);
    if (result.updatedAt) setPreviewVersion(result.updatedAt);
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    const result = await publishDocumentAction(doc.id);
    setPublishing(false);
    if (result.error) setError(result.error);
    else setPublishedUrl(result.url);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- toolbar --- */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-baseline gap-3">
          <a href={backHref} className="shrink-0 text-[13px] text-slate-400 hover:text-slate-900">
            ← {backLabel}
          </a>
          <span className="truncate text-[15px] font-medium text-slate-900">{doc.name}</span>
          {dirty && <span className="shrink-0 text-[12px] text-amber-600">未保存の変更があります</span>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <GuidelineCheckButton doc={doc} documentId={doc.id} />
          <a
            href={`${previewUrl}?v=${encodeURIComponent(previewVersion)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50"
          >
            別タブで開く
          </a>
          {!doc.isTemplate && (
            <button
              type="button"
              onClick={publish}
              disabled={publishing || dirty}
              title={dirty ? "先に保存してください" : undefined}
              className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              {publishing ? "公開中…" : "公開する"}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>

      {error && (
        <p className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </p>
      )}
      {publishedUrl && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
          公開しました:{" "}
          <a href={publishedUrl} target="_blank" rel="noreferrer" className="underline">
            {publishedUrl}
          </a>
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* --- left: structure (unchanged) — add/reorder/delete blocks, list items, global design, SEO.
             These stay form-based because there's nothing on the page yet to click for them: adding a
             block, or a new FAQ item, has no "existing text" to select. --- */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:max-h-[calc(100vh-9rem)] lg:w-[300px] lg:overflow-y-auto lg:pr-1">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setSelectedId(null);
                }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  tab === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "blocks" &&
            (selected ? (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="self-start text-[13px] text-slate-400 hover:text-slate-900"
                >
                  ← ブロック一覧へ戻る
                </button>
                <BlockEditor
                  block={selected}
                  documentId={doc.id}
                  assetBase={assetBase}
                  onChange={replaceBlock}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] leading-relaxed text-slate-400">
                  文章や画像は、右のプレビューを直接クリックして編集できます。ここでは、ブロックの追加・並べ替え・削除、リスト項目（FAQ・スタッフなど）の追加・削除を行います。
                </p>
                <BlockList
                  blocks={doc.blocks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={reorder}
                  onToggleVisible={(id) =>
                    update((current) => ({
                      ...current,
                      blocks: current.blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
                    }))
                  }
                  onDelete={(id) => {
                    if (selectedId === id) setSelectedId(null);
                    if (canvasSelection?.blockId === id) setCanvasSelection(null);
                    update((current) => ({ ...current, blocks: current.blocks.filter((b) => b.id !== id) }));
                  }}
                />
                <AddBlockPalette
                  blocks={doc.blocks}
                  onAdd={(block) => {
                    update((current) => ({ ...current, blocks: [...current.blocks, block] }));
                    setSelectedId(block.id);
                  }}
                />
              </div>
            ))}

          {tab === "design" && (
            <DesignPanel design={doc.design} onChange={(design) => update((current) => ({ ...current, design }))} />
          )}

          {tab === "meta" && (
            <MetaPanel
              meta={doc.meta}
              documentId={doc.id}
              assetBase={assetBase}
              isTemplate={doc.isTemplate}
              onChange={(meta) => update((current) => ({ ...current, meta }))}
            />
          )}
        </div>

        {/* --- center: the live, clickable canvas --- */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-[4.5rem]">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-[12px] text-slate-400">テキストや画像をクリックすると編集できます</span>
              {dirty && <span className="text-[12px] text-amber-600">保存すると構成の変更が反映されます</span>}
            </div>
            <div className="h-[calc(100vh-12rem)] min-h-[520px] w-full">
              <VisualCanvas
                doc={doc}
                previewUrl={previewUrl}
                previewVersion={previewVersion}
                assetBase={assetBase}
                selection={canvasSelection}
                onSelect={setCanvasSelection}
                onTextEdit={handleCanvasTextEdit}
              />
            </div>
          </div>
        </div>

        {/* --- right: the new contextual editing panel (Font/Color/Image/Padding/Margin) --- */}
        <div className="w-full shrink-0 lg:max-h-[calc(100vh-9rem)] lg:w-[340px] lg:overflow-y-auto">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:sticky lg:top-[4.5rem]">
            <Inspector
              doc={doc}
              selection={canvasSelection}
              documentId={doc.id}
              assetBase={assetBase}
              onChangeBlock={replaceBlock}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
