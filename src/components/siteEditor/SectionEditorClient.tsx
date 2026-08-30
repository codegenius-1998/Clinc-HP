"use client";

import { useState, useTransition } from "react";
import type { SiteTemplate } from "@/lib/generatedSite/types";
import { saveGeneratedTemplateAction, regenerateSectionAction } from "@/lib/contentActions";
import { EditorBar } from "./EditorBar";
import { Group } from "./editorFields";
import { SectionFields } from "./SectionFields";
import { REGENERATABLE, sectionTitle } from "./shared";

/** One section's content editor, on its own page. Loads the whole template, edits a single
 * section's slice, and saves the whole template back (re-rendering the bundle). */
export function SectionEditorClient({
  slug,
  clinicName,
  initialTemplate,
  initialUrl,
  sectionId,
  editBase,
}: {
  slug: string;
  clinicName: string;
  initialTemplate: SiteTemplate;
  initialUrl: string;
  sectionId: string;
  /** `/admin/requests/<slug>/edit` — the "← セクション一覧へ" target. */
  editBase: string;
}) {
  const seed: SiteTemplate = { ...initialTemplate, customBlocks: initialTemplate.customBlocks ?? [] };
  const [template, setTemplate] = useState<SiteTemplate>(seed);
  const [baseline, setBaseline] = useState(() => JSON.stringify(seed));
  const dirty = JSON.stringify(template) !== baseline;

  const [saving, startSaving] = useTransition();
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const label = sectionTitle(template, sectionId);

  function doSave() {
    startSaving(async () => {
      setMessage(null);
      const r = await saveGeneratedTemplateAction(slug, template);
      if (r.ok) {
        setBaseline(JSON.stringify(template));
        setMessage({ kind: "ok", text: "保存しました。「プレビュー」タブを再読み込みすると反映されます。" });
      } else {
        setMessage({ kind: "err", text: r.error });
      }
    });
  }

  async function regenerate() {
    setRegenerating(true);
    setMessage(null);
    try {
      const r = await regenerateSectionAction(slug, sectionId, template);
      if (r.ok) setTemplate(r.template);
      else setMessage({ kind: "err", text: r.error });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <EditorBar
        backHref={editBase}
        backLabel="セクション一覧へ"
        title={`${clinicName}／${label}`}
        previewUrl={initialUrl}
        dirty={dirty}
        saving={saving}
        onSave={doSave}
        message={message}
      />

      <Group title={label} open>
        <SectionFields id={sectionId} template={template} onChange={setTemplate} slug={slug} />
        {REGENERATABLE.has(sectionId) && (
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating || saving}
            className="mt-1 self-start rounded-md border border-slate-300 px-2.5 py-1 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {regenerating ? "AIで書き直し中… (最大30秒)" : "このセクションの文章をAIで再生成"}
          </button>
        )}
      </Group>

      <p className="py-4 text-center text-[12px] text-slate-400">
        編集したら「保存」してください。並び順や他のセクションは「← セクション一覧へ」から。
      </p>
    </div>
  );
}
