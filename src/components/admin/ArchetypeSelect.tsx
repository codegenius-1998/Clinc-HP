"use client";

import { ARCHETYPES, ARCHETYPE_KEYS } from "@/lib/site/archetypes";

/** Picks the block layout a new template is built on.
 *
 * Until this existed every imported template got the same twelve sections in the same order, and only
 * its colours and typography came from the reference site — which is why four templates looked like
 * one template in four palettes. This is the knob that changes that.
 *
 * `allowAuto` adds an empty-valued first option meaning "read the reference site and decide". It is
 * offered only where there IS a reference site to read: importing from a site this app generated has
 * no external skeleton to imitate, so there the admin's own choice is the only honest answer.
 *
 * ⚠️ The empty value is what the action sees as "no choice" — `isArchetypeKey("")` is false, which is
 * already how templateActions treats a tampered or missing field. No extra sentinel to keep in step. */
export function ArchetypeSelect({ allowAuto = false }: { allowAuto?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-slate-700">ページ構成</span>
      <select
        name="archetype"
        defaultValue={allowAuto ? "" : "one-page-classic"}
        className="rounded-lg border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-slate-400"
      >
        {allowAuto && <option value="">参考サイトに合わせる（おまかせ）</option>}
        {ARCHETYPE_KEYS.map((key) => (
          <option key={key} value={key}>
            {ARCHETYPES[key].label}
          </option>
        ))}
      </select>
      <span className="text-[12px] leading-relaxed text-slate-400">
        {allowAuto && (
          <span className="block">
            <b className="font-medium text-slate-500">おまかせ</b> —
            参考サイトのナビとセクションの並びを読み取り、近い構成を選びます。どれにも当てはまらなければAIがページ構成を組み立てます。
          </span>
        )}
        {ARCHETYPE_KEYS.map((key) => (
          <span key={key} className="block">
            <b className="font-medium text-slate-500">{ARCHETYPES[key].label}</b> — {ARCHETYPES[key].description}
          </span>
        ))}
      </span>
    </label>
  );
}
