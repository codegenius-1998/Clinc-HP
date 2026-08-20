"use client";

import { resolveFieldDefinition, blockSupportsPadding } from "@/lib/site/blocks";
import { getFieldValue, setFieldValue } from "@/lib/site/fieldPath";
import type { DesignTokens, Block, SiteDocument } from "@/lib/site/document";
import { ColorField, ImageField, NumberField, SelectField } from "./fields";

/** The right-hand panel of the visual editor. Shows controls for whatever was last clicked on the
 * canvas (`VisualCanvas.tsx`) — nothing when there's no selection, an image-swap UI for an image
 * field, or font/color controls for a text field — plus, always, the containing block's spacing.
 * Spacing is deliberately block-scoped rather than per-field (confirmed with the person who requested
 * this feature): "more space above/below this section" is a normal page-builder concept, "padding
 * around one clicked headline" isn't, and block-scoping keeps the schema/UI far simpler. */

export type Selection = { blockId: string; fieldPath: string };

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

function updateSpacing(block: Block, patch: Partial<NonNullable<Block["spacing"]>>): Block {
  return { ...block, spacing: { ...block.spacing, ...patch } };
}

function resetTextStyle(block: Block, path: string): Block {
  if (!block.textStyles) return block;
  const rest = Object.fromEntries(Object.entries(block.textStyles).filter(([key]) => key !== path));
  return { ...block, textStyles: Object.keys(rest).length > 0 ? rest : undefined };
}

export function Inspector({
  doc,
  selection,
  documentId,
  assetBase,
  onChangeBlock,
}: {
  doc: SiteDocument;
  selection: Selection | null;
  documentId: string;
  assetBase: string;
  onChangeBlock: (next: Block) => void;
}) {
  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[13px] text-slate-400">
          プレビュー内のテキストや画像をクリックすると、
          <br />
          ここに編集用の項目が表示されます。
        </p>
      </div>
    );
  }

  const block = doc.blocks.find((b) => b.id === selection.blockId);
  if (!block) return null;

  const field = resolveFieldDefinition(block.type, selection.fieldPath);
  const style = block.textStyles?.[selection.fieldPath];
  const spacing = block.spacing;
  const supportsPadding = blockSupportsPadding(block.type);

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {field && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[12px] font-medium text-slate-400">{field.label}</p>

          {field.type === "image" ? (
            <ImageField
              label="画像"
              value={String(getFieldValue(block.data, selection.fieldPath) ?? "")}
              documentId={documentId}
              assetBase={assetBase}
              onChange={(value) => onChangeBlock({ ...block, data: setFieldValue(block.data, selection.fieldPath, value) } as Block)}
            />
          ) : (
            <>
              <ColorField
                label="文字色"
                value={style?.color ?? doc.design.colors.text}
                onChange={(color) => onChangeBlock(updateTextStyle(block, selection.fieldPath, { color }))}
              />
              <SelectField
                label="フォント"
                value={style?.fontFamily ?? ""}
                options={buildFontOptions(doc.design.font, style?.fontFamily ?? "")}
                onChange={(fontFamily) =>
                  onChangeBlock(updateTextStyle(block, selection.fieldPath, { fontFamily: fontFamily || undefined }))
                }
              />
              <NumberField
                label="文字サイズ"
                value={style?.fontSize ?? doc.design.font.baseSize}
                min={10}
                max={96}
                unit="px"
                onChange={(fontSize) => onChangeBlock(updateTextStyle(block, selection.fieldPath, { fontSize }))}
              />
              <NumberField
                label="太さ"
                value={style?.fontWeight ?? 400}
                min={300}
                max={900}
                step={100}
                onChange={(fontWeight) => onChangeBlock(updateTextStyle(block, selection.fieldPath, { fontWeight }))}
              />
              {style && (
                <button
                  type="button"
                  onClick={() => onChangeBlock(resetTextStyle(block, selection.fieldPath))}
                  className="self-start text-[12px] text-slate-400 underline underline-offset-4 hover:text-slate-900"
                >
                  文字の見た目を既定に戻す
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[12px] font-medium text-slate-400">このセクションの余白</p>
        {supportsPadding && (
          <>
            <NumberField
              label="上の余白"
              value={spacing?.paddingTop ?? Math.round(DEFAULT_SECTION_PADDING_PX * doc.design.layout.spacingScale)}
              min={0}
              max={200}
              unit="px"
              onChange={(paddingTop) => onChangeBlock(updateSpacing(block, { paddingTop }))}
            />
            <NumberField
              label="下の余白"
              value={spacing?.paddingBottom ?? Math.round(DEFAULT_SECTION_PADDING_PX * doc.design.layout.spacingScale)}
              min={0}
              max={200}
              unit="px"
              onChange={(paddingBottom) => onChangeBlock(updateSpacing(block, { paddingBottom }))}
            />
          </>
        )}
        <NumberField
          label="上の外側マージン"
          value={spacing?.marginTop ?? 0}
          min={0}
          max={200}
          unit="px"
          onChange={(marginTop) => onChangeBlock(updateSpacing(block, { marginTop }))}
        />
        <NumberField
          label="下の外側マージン"
          value={spacing?.marginBottom ?? 0}
          min={0}
          max={200}
          unit="px"
          onChange={(marginBottom) => onChangeBlock(updateSpacing(block, { marginBottom }))}
        />
        {spacing && (
          <button
            type="button"
            onClick={() => onChangeBlock({ ...block, spacing: undefined })}
            className="self-start text-[12px] text-slate-400 underline underline-offset-4 hover:text-slate-900"
          >
            余白を既定に戻す
          </button>
        )}
      </div>
    </div>
  );
}
