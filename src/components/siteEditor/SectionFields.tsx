"use client";

import type { SiteTemplate } from "@/lib/generatedSite/types";
import {
  TextField,
  TextArea,
  StringListField,
  ImageField,
  SelectField,
} from "./editorFields";

/** Per-section field forms for the generated-site editor. Each block edits `template.sections[id]`
 * in place through `onChange`, which replaces the whole template with a shallow-cloned copy. */

type Props = {
  id: string;
  template: SiteTemplate;
  onChange: (next: SiteTemplate) => void;
  slug: string;
};

const MEDICAL_ICONS = ["skin", "child", "sparkle", "care", "tooth", "eye", "bone", "heart", "allergy", "general"];

export function SectionFields({ id, template, onChange, slug }: Props) {
  const S = template.sections;

  /** Replace one section object with a merged copy. */
  function set<K extends keyof SiteTemplate["sections"]>(
    key: K,
    partial: Partial<SiteTemplate["sections"][K]>
  ) {
    onChange({
      ...template,
      sections: { ...S, [key]: { ...S[key], ...partial } },
    });
  }

  const vibe = [template.brand.name, S.medical.items[0]?.ja].filter(Boolean).join(" / ");

  switch (id) {
    case "hero":
      return (
        <>
          <TextField label="タグライン" value={S.hero.tagline} onChange={(v) => set("hero", { tagline: v })} />
          <StringListField
            label="見出し（1行1要素・*語句*で強調色）"
            items={S.hero.headline}
            onChange={(headline) => set("hero", { headline })}
          />
          <TextArea label="リード文" value={S.hero.sub} rows={3} onChange={(v) => set("hero", { sub: v })} />
          <StringListField
            label="特長バブル（最大6）"
            items={S.hero.bubbles}
            onChange={(bubbles) => set("hero", { bubbles: bubbles.slice(0, 6) })}
          />
          <ImageField
            label="ヒーロー画像（既定は装飾イラスト）"
            src={S.hero.image.src}
            slug={slug}
            onChange={(src) => set("hero", { image: { ...S.hero.image, src } })}
          />
        </>
      );

    case "greeting":
      return (
        <>
          <HeadingField id="greeting" template={template} onChange={onChange} />
          <TextField label="院長名" value={S.greeting.doctorName} onChange={(v) => set("greeting", { doctorName: v })} />
          <TextField label="肩書き" value={S.greeting.doctorRole} onChange={(v) => set("greeting", { doctorRole: v })} />
          <ParagraphList
            label="メッセージ（段落）"
            items={S.greeting.message}
            onChange={(message) => set("greeting", { message })}
          />
          <ImageField
            label="院長ポートレート"
            src={S.greeting.image.src}
            slug={slug}
            aiKind="portrait"
            aiHint={`${S.greeting.doctorRole || "医師"} ${vibe}`}
            onChange={(src) => set("greeting", { image: { ...S.greeting.image, src } })}
          />
        </>
      );

    case "medical":
      return (
        <>
          <HeadingField id="medical" template={template} onChange={onChange} />
          <TextArea label="導入文" value={S.medical.intro} rows={2} onChange={(v) => set("medical", { intro: v })} />
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">診療カード</span>
            {S.medical.items.map((it, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
                <div className="flex gap-2">
                  <div className="w-28">
                    <SelectField
                      label="アイコン"
                      value={it.icon}
                      options={MEDICAL_ICONS.map((v) => ({ value: v, label: v }))}
                      onChange={(icon) =>
                        set("medical", { items: S.medical.items.map((x, j) => (j === i ? { ...x, icon } : x)) })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <TextField
                      label="診療科名（和）"
                      value={it.ja}
                      onChange={(ja) =>
                        set("medical", { items: S.medical.items.map((x, j) => (j === i ? { ...x, ja } : x)) })
                      }
                    />
                  </div>
                </div>
                <TextField
                  label="英字ラベル"
                  value={it.en}
                  onChange={(en) =>
                    set("medical", { items: S.medical.items.map((x, j) => (j === i ? { ...x, en } : x)) })
                  }
                />
                <TextArea
                  label="説明"
                  rows={2}
                  value={it.lead}
                  onChange={(lead) =>
                    set("medical", { items: S.medical.items.map((x, j) => (j === i ? { ...x, lead } : x)) })
                  }
                />
                <button
                  type="button"
                  className="self-end text-[12px] text-slate-400 hover:text-red-600"
                  onClick={() => set("medical", { items: S.medical.items.filter((_, j) => j !== i) })}
                >
                  このカードを削除
                </button>
              </div>
            ))}
            <button
              type="button"
              className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
              onClick={() =>
                set("medical", {
                  items: [...S.medical.items, { icon: "general", ja: "", en: "Medical", lead: "" }],
                })
              }
            >
              ＋ カードを追加
            </button>
          </div>
          <StringListField
            label="扱う主な症状（タグ）"
            items={S.medical.conditions}
            onChange={(conditions) => set("medical", { conditions })}
          />
        </>
      );

    case "philosophy":
      return (
        <>
          <HeadingField id="philosophy" template={template} onChange={onChange} />
          <TextField label="リード（短い一節）" value={S.philosophy.lead} onChange={(v) => set("philosophy", { lead: v })} />
          <ParagraphList
            label="本文（段落）"
            items={S.philosophy.body}
            onChange={(body) => set("philosophy", { body })}
          />
        </>
      );

    case "gallery":
      return (
        <>
          <HeadingField id="gallery" template={template} onChange={onChange} />
          <TextArea label="導入文" rows={2} value={S.gallery.intro} onChange={(v) => set("gallery", { intro: v })} />
          {S.gallery.items.map((it, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
              <TextField
                label="キャプション"
                value={it.caption}
                onChange={(caption) =>
                  set("gallery", { items: S.gallery.items.map((x, j) => (j === i ? { ...x, caption } : x)) })
                }
              />
              <ImageField
                label="写真"
                src={it.image.src}
                slug={slug}
                aiKind="interior"
                aiHint={`${it.caption} ${vibe}`}
                onChange={(src) =>
                  set("gallery", {
                    items: S.gallery.items.map((x, j) => (j === i ? { ...x, image: { ...x.image, src } } : x)),
                  })
                }
              />
              <button
                type="button"
                className="self-end text-[12px] text-slate-400 hover:text-red-600"
                onClick={() => set("gallery", { items: S.gallery.items.filter((_, j) => j !== i) })}
              >
                この写真を削除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() =>
              set("gallery", { items: [...S.gallery.items, { caption: "", image: { src: null, alt: "" } }] })
            }
          >
            ＋ 写真を追加
          </button>
        </>
      );

    case "schedule":
      return (
        <>
          <HeadingField id="schedule" template={template} onChange={onChange} />
          <TextField
            label="曜日（カンマ区切り）"
            value={S.schedule.days.join(",")}
            onChange={(v) => set("schedule", { days: v.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
          {S.schedule.rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
              <TextField
                label="時間帯ラベル"
                value={row.label}
                onChange={(label) =>
                  set("schedule", { rows: S.schedule.rows.map((x, j) => (j === i ? { ...x, label } : x)) })
                }
              />
              <TextField
                label={`記号（${S.schedule.days.length}個・カンマ区切り・空=／）`}
                value={row.marks.map((m) => m ?? "").join(",")}
                onChange={(v) =>
                  set("schedule", {
                    rows: S.schedule.rows.map((x, j) =>
                      j === i ? { ...x, marks: v.split(",").map((s) => (s.trim() ? s.trim() : null)) } : x
                    ),
                  })
                }
              />
              <button
                type="button"
                className="self-end text-[12px] text-slate-400 hover:text-red-600"
                onClick={() => set("schedule", { rows: S.schedule.rows.filter((_, j) => j !== i) })}
              >
                この行を削除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() =>
              set("schedule", {
                rows: [...S.schedule.rows, { label: "", marks: S.schedule.days.map(() => "●") }],
              })
            }
          >
            ＋ 行を追加
          </button>
          <StringListField label="注記" items={S.schedule.notes} onChange={(notes) => set("schedule", { notes })} />
        </>
      );

    case "fees":
      return (
        <>
          <HeadingField id="fees" template={template} onChange={onChange} />
          <TextArea
            label="注意書き"
            rows={2}
            value={S.fees.disclaimer}
            onChange={(v) => set("fees", { disclaimer: v })}
          />
          {S.fees.groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
              <TextField
                label="分類名"
                value={g.group}
                onChange={(group) =>
                  set("fees", { groups: S.fees.groups.map((x, j) => (j === gi ? { ...x, group } : x)) })
                }
              />
              {g.items.map((it, ii) => (
                <div key={ii} className="flex gap-1.5">
                  <div className="flex-1">
                    <TextField
                      label="項目"
                      value={it.name}
                      onChange={(name) =>
                        set("fees", {
                          groups: S.fees.groups.map((x, j) =>
                            j === gi
                              ? { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, name } : y)) }
                              : x
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="w-28">
                    <TextField
                      label="金額"
                      value={it.price}
                      onChange={(price) =>
                        set("fees", {
                          groups: S.fees.groups.map((x, j) =>
                            j === gi
                              ? { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, price } : y)) }
                              : x
                          ),
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="削除"
                    className="mt-5 shrink-0 px-1 text-[12px] text-slate-400 hover:text-red-600"
                    onClick={() =>
                      set("fees", {
                        groups: S.fees.groups.map((x, j) =>
                          j === gi ? { ...x, items: x.items.filter((_, k) => k !== ii) } : x
                        ),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-300 px-2 py-0.5 text-[12px] text-slate-500"
                  onClick={() =>
                    set("fees", {
                      groups: S.fees.groups.map((x, j) =>
                        j === gi ? { ...x, items: [...x.items, { name: "", price: "" }] } : x
                      ),
                    })
                  }
                >
                  ＋ 項目
                </button>
                <button
                  type="button"
                  className="text-[12px] text-slate-400 hover:text-red-600"
                  onClick={() => set("fees", { groups: S.fees.groups.filter((_, j) => j !== gi) })}
                >
                  この分類を削除
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() => set("fees", { groups: [...S.fees.groups, { group: "", items: [{ name: "", price: "" }] }] })}
          >
            ＋ 分類を追加
          </button>
        </>
      );

    case "flow":
      return (
        <>
          <HeadingField id="flow" template={template} onChange={onChange} />
          {S.flow.steps.map((st, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
              <TextField
                label="ステップ名"
                value={st.title}
                onChange={(title) =>
                  set("flow", { steps: S.flow.steps.map((x, j) => (j === i ? { ...x, title } : x)) })
                }
              />
              <TextArea
                label="説明"
                rows={2}
                value={st.body}
                onChange={(body) =>
                  set("flow", { steps: S.flow.steps.map((x, j) => (j === i ? { ...x, body } : x)) })
                }
              />
              <button
                type="button"
                className="self-end text-[12px] text-slate-400 hover:text-red-600"
                onClick={() =>
                  set("flow", {
                    steps: S.flow.steps
                      .filter((_, j) => j !== i)
                      .map((x, j) => ({ ...x, no: String(j + 1).padStart(2, "0") })),
                  })
                }
              >
                このステップを削除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() =>
              set("flow", {
                steps: [
                  ...S.flow.steps,
                  { no: String(S.flow.steps.length + 1).padStart(2, "0"), title: "", body: "" },
                ],
              })
            }
          >
            ＋ ステップを追加
          </button>
        </>
      );

    case "faq":
      return (
        <>
          <HeadingField id="faq" template={template} onChange={onChange} />
          {S.faq.items.map((it, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
              <TextField
                label="質問"
                value={it.q}
                onChange={(q) => set("faq", { items: S.faq.items.map((x, j) => (j === i ? { ...x, q } : x)) })}
              />
              <TextArea
                label="回答"
                rows={2}
                value={it.a}
                onChange={(a) => set("faq", { items: S.faq.items.map((x, j) => (j === i ? { ...x, a } : x)) })}
              />
              <button
                type="button"
                className="self-end text-[12px] text-slate-400 hover:text-red-600"
                onClick={() => set("faq", { items: S.faq.items.filter((_, j) => j !== i) })}
              >
                この質問を削除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() => set("faq", { items: [...S.faq.items, { q: "", a: "" }] })}
          >
            ＋ 質問を追加
          </button>
        </>
      );

    case "news":
      return (
        <>
          <HeadingField id="news" template={template} onChange={onChange} />
          {S.news.items.map((it, i) => (
            <div key={i} className="flex gap-1.5">
              <div className="w-28">
                <TextField
                  label="日付"
                  value={it.date}
                  onChange={(date) =>
                    set("news", { items: S.news.items.map((x, j) => (j === i ? { ...x, date } : x)) })
                  }
                />
              </div>
              <div className="flex-1">
                <TextField
                  label="見出し"
                  value={it.title}
                  onChange={(title) =>
                    set("news", { items: S.news.items.map((x, j) => (j === i ? { ...x, title } : x)) })
                  }
                />
              </div>
              <button
                type="button"
                aria-label="削除"
                className="mt-5 shrink-0 px-1 text-[12px] text-slate-400 hover:text-red-600"
                onClick={() => set("news", { items: S.news.items.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() => set("news", { items: [...S.news.items, { date: "", title: "" }] })}
          >
            ＋ お知らせを追加
          </button>
        </>
      );

    case "access":
      return (
        <>
          <HeadingField id="access" template={template} onChange={onChange} />
          <StringListField
            label="アクセスのポイント"
            items={S.access.points}
            onChange={(points) => set("access", { points })}
          />
          {S.access.info.map((row, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-md border border-slate-200 p-2.5">
              <TextField
                label="項目名"
                value={row.term}
                onChange={(term) =>
                  set("access", { info: S.access.info.map((x, j) => (j === i ? { ...x, term } : x)) })
                }
              />
              <TextField
                label="内容（複数行はカンマ区切り）"
                value={row.lines.join(",")}
                onChange={(v) =>
                  set("access", {
                    info: S.access.info.map((x, j) =>
                      j === i ? { ...x, lines: v.split(",").map((s) => s.trim()).filter(Boolean) } : x
                    ),
                  })
                }
              />
              <button
                type="button"
                className="self-end text-[12px] text-slate-400 hover:text-red-600"
                onClick={() => set("access", { info: S.access.info.filter((_, j) => j !== i) })}
              >
                この行を削除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400"
            onClick={() => set("access", { info: [...S.access.info, { term: "", lines: [""] }] })}
          >
            ＋ 案内行を追加
          </button>
          <ImageField
            label="地図画像"
            src={S.access.image.src}
            slug={slug}
            aiKind="exterior"
            aiHint={`${template.brand.name} 外観 ${vibe}`}
            onChange={(src) => set("access", { image: { ...S.access.image, src } })}
          />
        </>
      );

    case "contact":
      return (
        <>
          <HeadingField id="contact" template={template} onChange={onChange} />
          <TextArea label="リード文" rows={2} value={S.contact.lead} onChange={(v) => set("contact", { lead: v })} />
          <TextField
            label="予約ボタンの文言"
            value={S.contact.reserveLabel}
            onChange={(v) => set("contact", { reserveLabel: v })}
          />
          <TextField label="注記" value={S.contact.note} onChange={(v) => set("contact", { note: v })} />
        </>
      );

    default:
      return <p className="text-[12px] text-slate-400">このセクションに編集項目はありません。</p>;
  }
}

// --- shared bits ---------------------------------------------------------

function HeadingField({
  id,
  template,
  onChange,
}: {
  id: keyof SiteTemplate["sections"];
  template: SiteTemplate;
  onChange: (t: SiteTemplate) => void;
}) {
  const sec = template.sections[id] as { heading?: { ja: string; en: string } };
  if (!sec.heading) return null;
  const setHeading = (partial: Partial<{ ja: string; en: string }>) =>
    onChange({
      ...template,
      sections: {
        ...template.sections,
        [id]: { ...template.sections[id], heading: { ...sec.heading, ...partial } },
      },
    });
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <TextField label="見出し（和）" value={sec.heading.ja} onChange={(ja) => setHeading({ ja })} />
      </div>
      <div className="w-28">
        <TextField label="英字" value={sec.heading.en} onChange={(en) => setHeading({ en })} />
      </div>
    </div>
  );
}

function ParagraphList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {items.map((p, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <textarea
            rows={3}
            value={p}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] leading-relaxed text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="button"
            aria-label="削除"
            className="shrink-0 rounded px-1.5 py-1 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-red-600"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="self-start rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        ＋ 段落を追加
      </button>
    </div>
  );
}
