"use client";

import { useMemo, useState } from "react";

/** The interactive centrepiece of the landing page: a real homepage, inside a device, that scrolls to
 * whichever section the reader points at.
 *
 * ⚠️ Every pixel here is a genuine screenshot of a page this app actually renders, taken by
 * scripts/shoot-templates.mts. Nothing is a mockup and nothing is imagined by an image model — a
 * sales page for a website builder that illustrates itself with a fake website is making a claim it
 * cannot keep. The section offsets are measured from the same render in the same pass, so the
 * "04 スタッフ紹介" button cannot drift away from where スタッフ紹介 actually is.
 *
 * ⚠️ These are TEMPLATES, never a real clinic's site. Putting a customer's homepage on a sales page
 * is a permission question, not a design decision. */

export type ShowcaseShot = { src: string; width: number; height: number };

export type ShowcaseEntry = {
  id: string;
  name: string;
  mood: string;
  tags: string[];
  previewUrl: string;
  desktop: ShowcaseShot;
  mobile: ShowcaseShot;
  /** ⚠️ One ratio PER DEVICE. The phone render of the same page is 60% taller than the desktop one
   * and its sections do not fall at the same fractions of it — sharing a single ratio put the phone
   * mockup two sections away from the one the reader clicked. */
  sections: { id: string; label: string; ratios: { desktop: number; mobile: number } }[];
};

/** The inside of each device frame, as width/height. These are the viewports the screenshots were
 * taken at, so the picture fills the frame at exactly the proportion it was rendered. */
const FRAME_ASPECT = { desktop: 1360 / 900, mobile: 390 / 844 } as const;

type Device = keyof typeof FRAME_ASPECT;

export function TemplateShowcase({ entries }: { entries: ShowcaseEntry[] }) {
  const [index, setIndex] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [section, setSection] = useState(0);

  const entry = entries[index];
  const shot = entry[device];

  // How far the picture may be pushed up before its bottom edge lifts off the frame. Without this,
  // asking for the last section on a short page would scroll the screenshot clean out of the device.
  const { offset, visible } = useMemo(() => {
    const visibleFraction = Math.min(1, (shot.width / FRAME_ASPECT[device]) / shot.height);
    const maxOffset = Math.max(0, 1 - visibleFraction);
    const wanted = entry.sections[section]?.ratios[device] ?? 0;
    return { offset: Math.min(Math.max(0, wanted), maxOffset), visible: visibleFraction };
  }, [device, entry, section, shot]);

  const choose = (next: number) => {
    setIndex(next);
    setSection(0);
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col">
        <p className="text-[11px] tracking-[0.35em] text-brand">01. デザインの型を選ぶ</p>
        <div className="mt-5 flex flex-col border-t border-line">
          {entries.map((candidate, i) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={i === index}
              className={`group border-b border-line py-4 text-left transition-colors ${
                i === index ? "text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="flex items-baseline gap-3">
                <span
                  className={`font-display text-[13px] transition-colors ${
                    i === index ? "text-brand" : "text-ink-soft/60"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[16px] tracking-[0.06em]">{candidate.name}</span>
              </span>
              <span
                aria-hidden
                className={`mt-2 block h-px origin-left bg-brand transition-transform duration-500 ${
                  i === index ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
          ))}
        </div>

        {entry.mood && <p className="mt-6 text-[13px] leading-[2] text-ink-soft">{entry.mood}</p>}

        {entry.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {entry.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="bg-brand-soft px-2.5 py-1 text-[11px] tracking-wide text-brand">
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="mt-10 text-[11px] tracking-[0.35em] text-brand">02. 中を見る</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2.5">
          {entry.sections.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(i)}
              aria-pressed={i === section}
              className={`text-[13px] transition-colors ${
                i === section ? "text-brand" : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="font-display text-[11px] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="ml-1.5">{item.label}</span>
            </button>
          ))}
        </div>

        <a
          href={entry.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="group mt-10 inline-flex items-center gap-2.5 self-start border-b border-brand pb-1 text-[13px] text-brand"
        >
          この見本をブラウザで開く
          <span aria-hidden className="arrow-slide">
            →
          </span>
        </a>
      </div>

      <div className="flex flex-col">
        <div className="mb-5 flex items-center justify-end gap-1 text-[12px]">
          {(
            [
              ["desktop", "パソコン"],
              ["mobile", "スマートフォン"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-pressed={device === key}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                device === key ? "bg-ink text-paper" : "text-ink-soft hover:bg-canvas"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={device === "mobile" ? "mx-auto w-full max-w-[300px]" : "w-full"}>
          {/* The frame. A rounded plate with a title bar for the laptop, a bezel with a notch for the
              phone — enough of a device to say "this is a screen" without drawing a whole product. */}
          <div
            className={`overflow-hidden border border-line bg-ink/90 shadow-[0_30px_70px_-45px_rgb(22_32_29/0.6)] ${
              device === "mobile" ? "rounded-[34px] p-2.5" : "rounded-xl p-2"
            }`}
          >
            {device === "desktop" && (
              <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
              </div>
            )}
            {device === "mobile" && (
              <div className="flex justify-center pb-2">
                <span className="h-1 w-14 rounded-full bg-white/25" />
              </div>
            )}

            <div
              className={`relative overflow-hidden bg-paper ${device === "mobile" ? "rounded-[24px]" : "rounded-md"}`}
              style={{ aspectRatio: String(FRAME_ASPECT[device]) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a plain <img> is the point:
                  the transform below is applied to the element's own intrinsic height, which
                  next/image's wrapper and sizing would get in the way of. */}
              <img
                key={`${entry.id}-${device}`}
                src={shot.src}
                alt={`${entry.name}の${entry.sections[section]?.label ?? ""}`}
                width={shot.width}
                height={shot.height}
                loading="lazy"
                decoding="async"
                className="absolute inset-x-0 top-0 w-full max-w-none transition-transform duration-[900ms] ease-[cubic-bezier(0.22,0.68,0.3,1)] motion-reduce:transition-none"
                style={{ transform: `translateY(${(-offset * 100).toFixed(3)}%)` }}
              />
            </div>
          </div>
        </div>

        {/* Where in the page we are — the same information the transform above is using, drawn so the
            reader can see that this is one continuous page rather than a set of separate pictures. */}
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-px flex-1 bg-line">
            <span
              className="absolute top-0 block h-px bg-brand transition-all duration-[900ms] ease-[cubic-bezier(0.22,0.68,0.3,1)] motion-reduce:transition-none"
              style={{ left: `${(offset * 100).toFixed(2)}%`, width: `${(visible * 100).toFixed(2)}%` }}
            />
          </div>
          <p className="shrink-0 text-[12px] text-ink-soft">
            全 {entry.sections.length} セクション ／ 高さ {shot.height.toLocaleString("ja-JP")}px
          </p>
        </div>
      </div>
    </div>
  );
}
