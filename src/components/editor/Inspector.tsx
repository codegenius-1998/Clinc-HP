"use client";

import { resolveFieldDefinition, blockSupportsPadding } from "@/lib/site/blocks";
import { getFieldValue, setFieldValue } from "@/lib/site/fieldPath";
import type { ContainerStyle, DesignTokens, Block, SiteDocument } from "@/lib/site/document";
import { AiRewritePanel } from "./AiRewritePanel";
import { ColorField, ImageField, NumberField, SelectField } from "./fields";

/** The right-hand panel of the visual editor. Shows controls for whatever was last clicked on the
 * canvas (`VisualCanvas.tsx`), and nothing else:
 *   a VALUE (text/image) → colour, font, size, weight, or the image swapper
 *   a BOX   (section / inner wrapper / card) → background, text colour, padding, margin
 *
 * Spacing used to hang off the value panel too, which put "このセクションの余白" on screen while the
 * user was editing a headline, as though it belonged to that headline. Spacing belongs to a box, so
 * it is now reachable only by selecting one. */

/** What the canvas last had clicked. Exactly one of `fieldPath` / `containerPath` is set:
 *  - `fieldPath`     — a VALUE inside the block's data (text or image). Editing changes content.
 *  - `containerPath` — a BOX the renderer drew (the <section>, its inner wrapper, or one card).
 *    Editing changes only presentation: background/text colour, padding, margin. */
export type Selection = { blockId: string; fieldPath?: string; containerPath?: string };

/** `.section` renders `padding: calc(2rem * var(--space-scale)) ...` — this mirrors that default so
 * the padding sliders show the space that's ACTUALLY there before the user has touched anything,
 * rather than lying with a 0 that doesn't match what they see on the canvas. 16px is the browser's
 * un-overridden root font-size, which `rem` resolves against here since <html> never sets its own. */
const DEFAULT_SECTION_PADDING_PX = 2 * 16;

/** Curated font choices for the per-text override. Deliberately system/web-safe stacks rather than
 * arbitrary Google Fonts: the renderer only loads the families listed in `design.font.googleFonts`
 * (see googleFontsHref in components.tsx), so an arbitrary Google Fonts name typed here would silently
 * fall back to the browser default instead of actually rendering. */
const FONT_FAMILY_CHOICES: { value: string; label: string }[] = [
  { value: "'Hiragino Kaku Gothic ProN', '游ゴシック体', 'Yu Gothic', sans-serif", label: "ゴシック体（游ゴシック系）" },
  { value: "'Hiragino Mincho ProN', '游明朝体', 'Yu Mincho', serif", label: "明朝体（游明朝系）" },
  { value: "'Meiryo', sans-serif", label: "メイリオ" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial（欧文・ゴシック系）" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia（欧文・明朝系）" },
  { value: "'Courier New', monospace", label: "等幅（Courier New）" },
];

/** Builds the dropdown's option list: the site's own heading/body fonts first (always safe — they're
 * already loaded), then the web-safe choices above, then — only if the field's current override
 * doesn't match any of those — the current value itself, so a pre-existing/custom value never renders
 * as a silently-wrong selection. */
function buildFontOptions(font: DesignTokens["font"], current: string): { value: string; label: string }[] {
  const options = [
    { value: "", label: "指定なし（全体のフォントを使う）" },
    { value: font.headingFamily, label: `見出しのフォント（${font.headingFamily}）` },
    { value: font.bodyFamily, label: `本文のフォント（${font.bodyFamily}）` },
    ...FONT_FAMILY_CHOICES,
  ];
  const deduped = options.filter((option, i) => options.findIndex((o) => o.value === option.value) === i);
  if (current && !deduped.some((o) => o.value === current)) {
    deduped.push({ value: current, label: `カスタム（${current}）` });
  }
  return deduped;
}

function updateTextStyle(block: Block, path: string, patch: Partial<NonNullable<Block["textStyles"]>[string]>): Block {
  const current = block.textStyles?.[path] ?? {};
  const next = { ...current, ...patch };
  return { ...block, textStyles: { ...block.textStyles, [path]: next } };
}

function resetTextStyle(block: Block, path: string): Block {
  if (!block.textStyles) return block;
  const rest = Object.fromEntries(Object.entries(block.textStyles).filter(([key]) => key !== path));
  return { ...block, textStyles: Object.keys(rest).length > 0 ? rest : undefined };
}


function updateContainerStyle(block: Block, path: string, patch: Partial<ContainerStyle>): Block {
  const current = block.containerStyles?.[path] ?? {};
  return { ...block, containerStyles: { ...block.containerStyles, [path]: { ...current, ...patch } } };
}

function resetContainer(block: Block, path: string): Block {
  const rest = Object.fromEntries(Object.entries(block.containerStyles ?? {}).filter(([key]) => key !== path));
  const next: Block = { ...block, containerStyles: Object.keys(rest).length > 0 ? rest : undefined };
  // "section" keeps its padding/margin in `spacing`, not in containerStyles — resetting the box has to
  // clear both or half the override survives an apparent reset.
  return path === "section" ? { ...next, spacing: undefined } : next;
}

const CONTAINER_LABELS: Record<string, string> = { section: "セクション全体", inner: "内側のまとまり" };

function containerLabel(path: string): string {
  if (CONTAINER_LABELS[path]) return CONTAINER_LABELS[path];
  const card = /^card\.(\d+)$/.exec(path);
  return card ? `カード ${Number(card[1]) + 1}` : path;
}

/** Panel for a selected BOX. Padding/margin for "section" read and write `block.spacing` (the field
 * that already drives the renderer for section padding); every other container keeps all of its
 * numbers in `containerStyles`. `background`/`color` always live in `containerStyles`. */
function ContainerPanel({
  doc,
  block,
  path,
  documentId,
  onChangeBlock,
}: {
  doc: SiteDocument;
  block: Block;
  path: string;
  documentId: string;
  onChangeBlock: (next: Block) => void;
}) {
  const isSection = path === "section";
  const style = block.containerStyles?.[path];
  const spacing = block.spacing;
  const supportsPadding = !isSection || blockSupportsPadding(block.type);
  const defaultPadding = isSection
    ? Math.round(DEFAULT_SECTION_PADDING_PX * doc.design.layout.spacingScale)
    : 0;

  const padding = (key: "paddingTop" | "paddingBottom") =>
    isSection ? spacing?.[key] ?? defaultPadding : style?.[key] ?? 0;
  const margin = (key: "marginTop" | "marginBottom") => (isSection ? spacing?.[key] : style?.[key]) ?? 0;

  function setSpace(key: "paddingTop" | "paddingBottom" | "marginTop" | "marginBottom", value: number) {
    onChangeBlock(
      isSection
        ? { ...block, spacing: { ...block.spacing, [key]: value } }
        : updateContainerStyle(block, path, { [key]: value })
    );
  }

  const dirty = Boolean(style) || (isSection && Boolean(spacing));

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
        <p className="text-[12px] font-medium text-amber-800">選択中: {containerLabel(path)}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">
          文字をクリックすると文字の設定に切り替わります。
        </p>
      </div>

      {/* Only for the whole section: an instruction like "もっと親しみやすく" is about the section's
          copy as a whole, and a card or the inner wrapper is not the unit anyone phrases that in. */}
      {isSection && <AiRewritePanel documentId={documentId} block={block} onChangeBlock={onChangeBlock} />}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[12px] font-medium text-slate-400">色</p>
        <ColorField
          label="背景色"
          value={style?.background ?? doc.design.colors.background}
          onChange={(background) => onChangeBlock(updateContainerStyle(block, path, { background }))}
        />
        <ColorField
          label="文字色（この中の文字すべて）"
          value={style?.color ?? doc.design.colors.text}
          onChange={(color) => onChangeBlock(updateContainerStyle(block, path, { color }))}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[12px] font-medium text-slate-400">内側の余白（padding）</p>
        {supportsPadding ? (
          <>
            <NumberField label="上" value={padding("paddingTop")} min={0} max={200} unit="px" onChange={(v) => setSpace("paddingTop", v)} />
            <NumberField label="下" value={padding("paddingBottom")} min={0} max={200} unit="px" onChange={(v) => setSpace("paddingBottom", v)} />
            {!isSection && (
              <>
                <NumberField
                  label="左"
                  value={style?.paddingLeft ?? 0}
                  min={0}
                  max={200}
                  unit="px"
                  onChange={(paddingLeft) => onChangeBlock(updateContainerStyle(block, path, { paddingLeft }))}
                />
                <NumberField
                  label="右"
                  value={style?.paddingRight ?? 0}
                  min={0}
                  max={200}
                  unit="px"
                  onChange={(paddingRight) => onChangeBlock(updateContainerStyle(block, path, { paddingRight }))}
                />
              </>
            )}
          </>
        ) : (
          <p className="text-[12px] leading-relaxed text-slate-400">
            この種類のブロックは写真が枠いっぱいに広がるため、内側の余白は設定できません。下の外側の余白をお使いください。
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[12px] font-medium text-slate-400">外側の余白（margin）</p>
        <NumberField label="上" value={margin("marginTop")} min={0} max={200} unit="px" onChange={(v) => setSpace("marginTop", v)} />
        <NumberField label="下" value={margin("marginBottom")} min={0} max={200} unit="px" onChange={(v) => setSpace("marginBottom", v)} />
      </div>

      {dirty && (
        <button
          type="button"
          onClick={() => onChangeBlock(resetContainer(block, path))}
          className="self-start text-[12px] text-slate-400 underline underline-offset-4 hover:text-slate-900"
        >
          この箱の設定を既定に戻す
        </button>
      )}
    </div>
  );
}

/** Panel for a selected VALUE. */
function FieldPanel({
  doc,
  block,
  path,
  documentId,
  assetBase,
  onChangeBlock,
  onSelectSection,
}: {
  doc: SiteDocument;
  block: Block;
  path: string;
  documentId: string;
  assetBase: string;
  onChangeBlock: (next: Block) => void;
  onSelectSection: () => void;
}) {
  const field = resolveFieldDefinition(block.type, path);
  const style = block.textStyles?.[path];
  if (!field) return null;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[12px] font-medium text-slate-400">{field.label}</p>

        {field.type === "image" ? (
          <ImageField
            label="画像"
            value={String(getFieldValue(block.data, path) ?? "")}
            documentId={documentId}
            assetBase={assetBase}
            onChange={(value) => onChangeBlock({ ...block, data: setFieldValue(block.data, path, value) } as Block)}
          />
        ) : (
          <>
            <ColorField
              label="文字色"
              value={style?.color ?? doc.design.colors.text}
              onChange={(color) => onChangeBlock(updateTextStyle(block, path, { color }))}
            />
            <SelectField
              label="フォント"
              value={style?.fontFamily ?? ""}
              options={buildFontOptions(doc.design.font, style?.fontFamily ?? "")}
              onChange={(fontFamily) => onChangeBlock(updateTextStyle(block, path, { fontFamily: fontFamily || undefined }))}
            />
            <NumberField
              label="文字サイズ"
              value={style?.fontSize ?? doc.design.font.baseSize}
              min={10}
              max={96}
              unit="px"
              onChange={(fontSize) => onChangeBlock(updateTextStyle(block, path, { fontSize }))}
            />
            <NumberField
              label="太さ"
              value={style?.fontWeight ?? 400}
              min={300}
              max={900}
              step={100}
              onChange={(fontWeight) => onChangeBlock(updateTextStyle(block, path, { fontWeight }))}
            />
            {style && (
              <button
                type="button"
                onClick={() => onChangeBlock(resetTextStyle(block, path))}
                className="self-start text-[12px] text-slate-400 underline underline-offset-4 hover:text-slate-900"
              >
                文字の見た目を既定に戻す
              </button>
            )}
          </>
        )}
      </div>

      {/* Spacing lives on the box now, so give the user a one-click way to get there rather than
          leaving them to guess that clicking the section background is what opens it. */}
      <button
        type="button"
        onClick={onSelectSection}
        className="self-start rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800 transition-colors hover:bg-amber-100"
      >
        セクション全体（色・余白）を編集 →
      </button>
    </div>
  );
}

export function Inspector({
  doc,
  selection,
  documentId,
  assetBase,
  onChangeBlock,
  onSelect,
}: {
  doc: SiteDocument;
  selection: Selection | null;
  documentId: string;
  assetBase: string;
  onChangeBlock: (next: Block) => void;
  onSelect: (selection: Selection | null) => void;
}) {
  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[13px] leading-relaxed text-slate-400">
          プレビュー内をクリックすると、ここに編集用の項目が出ます。
        </p>
        <p className="text-[12px] leading-relaxed text-slate-400">
          <span className="text-blue-500">文字・画像</span>をクリック → 文字色やフォント
          <br />
          <span className="text-amber-600">背景・カード</span>をクリック → 色と余白
        </p>
      </div>
    );
  }

  const block = doc.blocks.find((b) => b.id === selection.blockId);
  if (!block) return null;

  if (selection.containerPath) {
    return (
      <ContainerPanel
        doc={doc}
        block={block}
        path={selection.containerPath}
        documentId={documentId}
        onChangeBlock={onChangeBlock}
      />
    );
  }
  if (!selection.fieldPath) return null;

  return (
    <FieldPanel
      doc={doc}
      block={block}
      path={selection.fieldPath}
      documentId={documentId}
      assetBase={assetBase}
      onChangeBlock={onChangeBlock}
      onSelectSection={() => onSelect({ blockId: block.id, containerPath: "section" })}
    />
  );
}
