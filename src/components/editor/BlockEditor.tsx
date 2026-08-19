"use client";

import { BLOCK_DEFINITIONS, type BlockField, type LeafField } from "@/lib/site/blocks";
import type { Block } from "@/lib/site/document";
import { ImageField, SelectField, TextField } from "./fields";

/** Builds the whole form for one block from its registry entry. Nothing here knows what a "staff
 * block" or a "pricing block" is — adding a field to a block means editing one entry in
 * src/lib/site/blocks.ts, and this component picks it up. */

type Data = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): Data[] {
  return Array.isArray(value) ? (value as Data[]) : [];
}

function LeafInput({
  field,
  value,
  documentId,
  assetBase,
  onChange,
}: {
  field: LeafField;
  value: unknown;
  documentId: string;
  assetBase: string;
  onChange: (next: string) => void;
}) {
  const label = field.optional ? `${field.label}（任意）` : field.label;

  if (field.type === "image") {
    return (
      <ImageField
        label={label}
        value={asString(value)}
        documentId={documentId}
        assetBase={assetBase}
        onChange={onChange}
      />
    );
  }
  return (
    <TextField
      label={label}
      value={asString(value)}
      placeholder={field.placeholder}
      multiline={field.type === "textarea"}
      rows={field.type === "textarea" ? 4 : undefined}
      onChange={onChange}
    />
  );
}

function ListEditor({
  field,
  items,
  documentId,
  assetBase,
  onChange,
}: {
  field: Extract<BlockField, { type: "list" }>;
  items: Data[];
  documentId: string;
  assetBase: string;
  onChange: (next: Data[]) => void;
}) {
  function update(index: number, key: string, value: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const atMax = field.max !== undefined && items.length >= field.max;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-medium text-slate-500">{field.label}</p>

      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-400">
              {field.itemLabel} {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="上へ移動"
                className="rounded px-1.5 py-0.5 text-[13px] text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="下へ移動"
                className="rounded px-1.5 py-0.5 text-[13px] text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded px-1.5 py-0.5 text-[12px] text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                削除
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {field.fields.map((leaf) => (
              <LeafInput
                key={leaf.key}
                field={leaf}
                value={item[leaf.key]}
                documentId={documentId}
                assetBase={assetBase}
                onChange={(next) => update(index, leaf.key, next)}
              />
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-[13px] text-slate-400">
          まだ{field.itemLabel}がありません。
        </p>
      )}

      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange([...items, field.newItem()])}
        className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        ＋ {field.itemLabel}を追加
      </button>
    </div>
  );
}

export function BlockEditor({
  block,
  documentId,
  assetBase,
  onChange,
}: {
  block: Block;
  documentId: string;
  assetBase: string;
  onChange: (next: Block) => void;
}) {
  const definition = BLOCK_DEFINITIONS[block.type];
  const data = block.data as Data;

  // The cast is confined to this one helper: `data` is the union member's own shape, and the fields
  // being written are exactly the keys that member declares (both come from the same registry entry).
  function setData(key: string, value: unknown) {
    onChange({ ...block, data: { ...data, [key]: value } } as Block);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-[13px] font-medium text-slate-700">
          {definition.icon} {definition.label}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{definition.description}</p>
      </div>

      <TextField
        label="メニューに表示する名前"
        value={block.navLabel}
        placeholder="空欄にするとメニューに出ません"
        hint="ページ上部のメニューとフッターのリンクに使われます。"
        onChange={(navLabel) => onChange({ ...block, navLabel })}
      />

      {definition.fields.map((field) => {
        if (field.type === "list") {
          return (
            <ListEditor
              key={field.key}
              field={field}
              items={asList(data[field.key])}
              documentId={documentId}
              assetBase={assetBase}
              onChange={(next) => setData(field.key, next)}
            />
          );
        }
        if (field.type === "select") {
          return (
            <SelectField
              key={field.key}
              label={field.label}
              value={String(data[field.key] ?? field.options[0].value)}
              options={field.options}
              onChange={(next) => setData(field.key, field.numeric ? Number(next) : next)}
            />
          );
        }
        return (
          <LeafInput
            key={field.key}
            field={field}
            value={data[field.key]}
            documentId={documentId}
            assetBase={assetBase}
            onChange={(next) => setData(field.key, next)}
          />
        );
      })}
    </div>
  );
}
