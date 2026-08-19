"use client";

import type { SiteMeta } from "@/lib/site/document";
import { ImageField, TextField } from "./fields";

/** Site-wide facts and search-engine text. These live on the document rather than on a block because
 * more than one block reads them: the phone number appears in the header, in the hero's CTA and in
 * the お問い合わせ block, and a clinic that changes its number should change it in one place. */
export function MetaPanel({
  meta,
  documentId,
  assetBase,
  isTemplate,
  onChange,
}: {
  meta: SiteMeta;
  documentId: string;
  assetBase: string;
  isTemplate: boolean;
  onChange: (next: SiteMeta) => void;
}) {
  function set(patch: Partial<SiteMeta>) {
    onChange({ ...meta, ...patch });
  }
  function setSeo(patch: Partial<SiteMeta["seo"]>) {
    onChange({ ...meta, seo: { ...meta.seo, ...patch } });
  }

  return (
    <div className="flex flex-col gap-4">
      {isTemplate && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
          テンプレートのこの欄はプレビュー用のサンプルです。実際のサイトを作るときは、ヒアリングシートの内容で上書きされます。
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-[13px] font-semibold text-slate-700">医院の基本情報</h3>
        <TextField label="医院名" value={meta.clinicName} onChange={(clinicName) => set({ clinicName })} />
        <ImageField
          label="ロゴ画像"
          value={meta.logoImage}
          documentId={documentId}
          assetBase={assetBase}
          onChange={(logoImage) => set({ logoImage })}
        />
        <TextField
          label="電話番号"
          value={meta.phone}
          hint="空欄にすると、ヘッダーの電話番号と「お電話で相談・予約する」ボタンが消えます。"
          onChange={(phone) => set({ phone })}
        />
        <TextField
          label="LINE ID"
          value={meta.line}
          hint="空欄にすると「LINEで相談・予約する」ボタンが消えます。"
          onChange={(line) => set({ line })}
        />
        <TextField label="住所" value={meta.address} multiline rows={2} onChange={(address) => set({ address })} />
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-[13px] font-semibold text-slate-700">SEO（検索結果の見え方）</h3>
        <TextField
          label="ページタイトル"
          value={meta.seo.title}
          hint="検索結果の見出しとブラウザのタブに出ます。30〜60字が目安です。"
          onChange={(title) => setSeo({ title })}
        />
        <TextField
          label="ページの説明文"
          value={meta.seo.metaDescription}
          multiline
          rows={3}
          hint={`検索結果の説明文です。100〜130字が目安（現在 ${meta.seo.metaDescription.length} 字）。`}
          onChange={(metaDescription) => setSeo({ metaDescription })}
        />
        <TextField
          label="SNSでシェアされたときのタイトル"
          value={meta.seo.ogTitle}
          onChange={(ogTitle) => setSeo({ ogTitle })}
        />
        <TextField
          label="SNSでシェアされたときの説明文"
          value={meta.seo.ogDescription}
          multiline
          rows={2}
          onChange={(ogDescription) => setSeo({ ogDescription })}
        />
        <TextField label="サイト名" value={meta.seo.ogSiteName} onChange={(ogSiteName) => setSeo({ ogSiteName })} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-[13px] font-semibold text-slate-700">SNSリンク（フッターに表示）</h3>
        {meta.snsLinks.map((link, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="w-28 shrink-0">
              <TextField
                label="表示名"
                value={link.label}
                onChange={(label) =>
                  set({ snsLinks: meta.snsLinks.map((l, i) => (i === index ? { ...l, label } : l)) })
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextField
                label="URL"
                value={link.href}
                onChange={(href) => set({ snsLinks: meta.snsLinks.map((l, i) => (i === index ? { ...l, href } : l)) })}
              />
            </div>
            <button
              type="button"
              onClick={() => set({ snsLinks: meta.snsLinks.filter((_, i) => i !== index) })}
              className="mb-2 rounded px-2 py-1 text-[12px] text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set({ snsLinks: [...meta.snsLinks, { label: "", href: "" }] })}
          className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-600 transition-colors hover:bg-slate-50"
        >
          ＋ SNSリンクを追加
        </button>
      </section>
    </div>
  );
}
