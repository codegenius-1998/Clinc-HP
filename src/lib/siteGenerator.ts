import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { getSiteSpec, isAiAuthoredSection, type SiteSpec, type SiteSpecSection } from "./siteSpec";
import { getDesignPreset, getColorTheme, type ColorTheme, type DesignPreset } from "./designPresets";
import { generateContentPlan, type ContentPlan, type ImageAspect } from "./openai/generateContentPlan";
import { generateSiteImage, type ImageStyle } from "./openai/generateSiteImage";
import { matchImagesToCategories, type ImageTarget as CategoryImageTarget } from "./openai/matchImageCategories";
import type { HearingSheet } from "./hearing";
import type { ImageCategoryKey } from "./imageCategories";
import type { HoursRow, NavItem, SectionView, SiteViewModel } from "./render/types";
import { renderSiteHtml } from "./render/renderSiteHtml";

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");
const SITE_CSS_SOURCE = path.join(process.cwd(), "src", "lib", "render", "site.css");
const SITE_JS_SOURCE = path.join(process.cwd(), "src", "lib", "render", "main.js");
const IMAGE_CONCURRENCY = 3;

export type GeneratedSite = {
  slug: string;
  previewUrl: string;
};

export async function generatedSiteExists(slug: string): Promise<boolean> {
  try {
    await readFile(path.join(GENERATED_ROOT, slug, "index.html"));
    return true;
  } catch {
    return false;
  }
}

/** Splits `hearing.hours` (free-form, newline-separated) into table rows, pulling a "label：value"
 * shape apart where present. Deterministic — never routed through the AI, so it can never drift from
 * what the clinic actually typed (see SITE_SPEC.json honestyRules). */
function hoursRowsFromHearing(hearing: HearingSheet): HoursRow[] {
  return (hearing.hours ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^(.*?)[：:](.*)$/);
      return match ? { label: match[1].trim(), value: match[2].trim() } : { label: "", value: line };
    });
}

type ResolvedSection = { id: string; label: string; order: number; visible: boolean };

/** Combines the user's explicit sectionPrefs (from the hearing screen's reorder UI — always wins when
 * present) with SITE_SPEC's default order/visibility (for older hearings saved before that UI
 * existed), and layers the "don't show an empty section" honesty rules on top: hours/access/pricing
 * only render when the backing hearing field actually has content, regardless of what the user
 * toggled — there's nothing honest to show otherwise. */
function resolveSections(siteSpec: SiteSpec, hearing: HearingSheet): ResolvedSection[] {
  const prefsById = new Map((hearing.sectionPrefs ?? []).map((p) => [p.id, p]));

  return siteSpec.sections.map((section) => {
    const pref = prefsById.get(section.id);
    const order = pref?.order ?? section.order;
    let visible = section.removable ? (pref?.visible ?? section.defaultVisible) : true;

    if (section.id === "hours") visible = visible && (hearing.hours ?? "").trim().length > 0;
    if (section.id === "access") visible = visible && (hearing.address ?? "").trim().length > 0;
    if (section.id === "staff") visible = visible && (hearing.staffMembers?.length ?? 0) > 0;
    if (section.id === "pricing") visible = visible && (hearing.priceItems?.length ?? 0) > 0;

    return { id: section.id, label: section.label, order, visible };
  });
}

const ASPECT_SIZE: Record<ImageAspect, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1200, height: 900 },
  "16:9": { width: 1200, height: 675 },
  "2:1": { width: 1200, height: 600 },
};

type ImageJob = {
  id: string;
  path: string;
  alt: string;
  role: ImageStyle;
  prompt?: string;
  targetSize: { width: number; height: number };
};

/** Turns the AI's `images` plan (sectionId/blockIndex pairs) into concrete, collision-free output
 * file paths, and adds the staff-photo jobs the content plan never sees (staff is never AI-authored —
 * see SITE_SPEC.json — so those slots are synthesized here directly from `hearing.staffMembers`). */
function buildImageJobs(
  hearing: HearingSheet,
  plan: ContentPlan,
  aiSectionIds: Set<string>,
  blockLayout: DesignPreset["blockLayout"]
): ImageJob[] {
  const jobs: ImageJob[] = [];
  const seenKeys = new Set<string>();

  for (const img of plan.images) {
    if (img.sectionId !== "header" && img.sectionId !== "hero" && !aiSectionIds.has(img.sectionId)) continue;
    // "minimal" block layout never renders a per-card image (see AiSection in components.tsx) — skip
    // generating one so a real API call isn't spent on a file the page will never reference.
    if (img.blockIndex !== undefined && blockLayout === "minimal") continue;
    const key = img.blockIndex !== undefined ? `${img.sectionId}-${img.blockIndex}` : img.sectionId;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const ext = img.role === "logo" ? "png" : "jpg";
    jobs.push({
      id: key,
      path: `images/${key}.${ext}`,
      alt: img.alt,
      role: img.role,
      prompt: img.prompt,
      targetSize: img.role === "logo" ? { width: 128, height: 128 } : ASPECT_SIZE[img.aspect],
    });
  }

  // Guarantee logo/hero exist even if the model omitted them from `images` — both are structural and
  // always rendered, so a missing job here would leave a broken <img src> in the final page.
  if (!seenKeys.has("header")) {
    jobs.push({ id: "header", path: "images/logo.png", alt: hearing.clinicName, role: "logo", targetSize: { width: 128, height: 128 } });
  }
  if (!seenKeys.has("hero")) {
    jobs.push({ id: "hero", path: "images/hero.jpg", alt: hearing.clinicName, role: "photo", targetSize: ASPECT_SIZE["2:1"] });
  }

  (hearing.staffMembers ?? []).forEach((member, i) => {
    if (member.photoUrl) return; // handled as a forced upload, not a generation job
    jobs.push({
      id: `staff-${i}`,
      path: `images/staff-${i}.jpg`,
      alt: member.name,
      role: "photo",
      prompt: undefined,
      targetSize: ASPECT_SIZE["1:1"],
    });
  });

  return jobs;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function buildSectionView(section: SiteSpecSection, plan: ContentPlan, imagePaths: Map<string, string>): SectionView {
  const content = plan.sections[section.id];
  const singleImage = imagePaths.get(section.id);
  const blocks = (content?.blocks ?? []).map((block, i) => ({
    heading: block.heading,
    body: block.body,
    image: imagePaths.get(`${section.id}-${i}`),
  }));
  return {
    id: section.id,
    label: section.label,
    heading: content?.heading ?? section.label,
    body: content?.body ?? "",
    blocks,
    image: singleImage,
  };
}

function buildViewModel(
  hearing: HearingSheet,
  preset: DesignPreset,
  colorTheme: ColorTheme,
  siteSpec: SiteSpec,
  resolved: ResolvedSection[],
  plan: ContentPlan,
  imagePaths: Map<string, string>
): SiteViewModel {
  const visibleOrdered = resolved.filter((s) => s.visible).sort((a, b) => a.order - b.order);
  const navItems: NavItem[] = visibleOrdered.map((s) => ({ id: s.id, label: s.label }));
  const aiSections: SectionView[] = siteSpec.sections
    .filter((s) => isAiAuthoredSection(s) && visibleOrdered.some((v) => v.id === s.id))
    .map((s) => buildSectionView(s, plan, imagePaths));

  const newsVisible = visibleOrdered.some((s) => s.id === "news");
  const faqVisible = visibleOrdered.some((s) => s.id === "faq");

  return {
    clinicName: hearing.clinicName,
    phone: hearing.phone || undefined,
    line: hearing.line || undefined,
    address: hearing.address || undefined,
    mapQuery: hearing.address ? encodeURIComponent(hearing.address) : undefined,
    logoImage: imagePaths.get("header") ?? "images/logo.png",
    heroImage: imagePaths.get("hero") ?? "images/hero.jpg",
    heroHeadline: plan.hero.headline,
    heroSubheadline: plan.hero.subheadline || undefined,
    theme: colorTheme,
    fontFamily: preset.fontFamily,
    cardStyle: preset.cardStyle,
    heroLayout: preset.heroLayout,
    blockLayout: preset.blockLayout,
    spacing: preset.spacing,
    seo: plan.seo,
    navItems,
    aiSections,
    hours: { visible: visibleOrdered.some((s) => s.id === "hours"), rows: hoursRowsFromHearing(hearing) },
    access: { visible: visibleOrdered.some((s) => s.id === "access") },
    news: {
      visible: newsVisible,
      items: hearing.news && hearing.news.length > 0 ? hearing.news : plan.newsFallback,
    },
    staff: {
      visible: visibleOrdered.some((s) => s.id === "staff"),
      members: (hearing.staffMembers ?? []).map((m, i) => ({
        name: m.name,
        role: m.role,
        comment: m.comment,
        image: m.photoUrl ? imagePaths.get(`staff-${i}`) ?? m.photoUrl : imagePaths.get(`staff-${i}`),
      })),
    },
    faq: {
      visible: faqVisible,
      items: hearing.faqs && hearing.faqs.length > 0 ? hearing.faqs : plan.faqFallback,
    },
    pricing: { visible: visibleOrdered.some((s) => s.id === "pricing"), items: hearing.priceItems ?? [] },
    snsLinks: [],
  };
}

export async function generateSite(hearing: HearingSheet): Promise<GeneratedSite> {
  const preset = hearing.templateId ? getDesignPreset(hearing.templateId) : undefined;
  if (!preset) {
    throw new Error("選択されたデザインプリセットが見つかりません。");
  }
  const colorTheme = getColorTheme(hearing.colorScheme);
  const siteSpec = getSiteSpec();
  const resolved = resolveSections(siteSpec, hearing);
  const aiSections = siteSpec.sections.filter((s) => isAiAuthoredSection(s) && resolved.some((r) => r.id === s.id && r.visible));
  const aiSectionIds = new Set(aiSections.map((s) => s.id));

  const needsNewsFallback = resolved.some((r) => r.id === "news" && r.visible) && (!hearing.news || hearing.news.length === 0);
  const needsFaqFallback = resolved.some((r) => r.id === "faq" && r.visible) && (!hearing.faqs || hearing.faqs.length === 0);

  const plan = await generateContentPlan(hearing, preset, colorTheme, siteSpec, aiSections, needsNewsFallback, needsFaqFallback);

  const outDir = path.join(GENERATED_ROOT, hearing.slug);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, "images"), { recursive: true });
  await mkdir(path.join(outDir, "css"), { recursive: true });
  await mkdir(path.join(outDir, "js"), { recursive: true });

  // --- images: AI-planned placements (logo/hero/section/block photos) plus staff photos the content
  // plan never authors. Uploaded photos win over AI generation wherever the category matcher finds a
  // fit; each uploaded photo is used at most once. ---
  const jobs = buildImageJobs(hearing, plan, aiSectionIds, preset.blockLayout);
  const uploadedImages = hearing.uploadedImages ?? {};
  const availableCategories = (Object.keys(uploadedImages) as ImageCategoryKey[]).filter((k) => (uploadedImages[k]?.length ?? 0) > 0);

  const matchableJobs = jobs.filter((j) => j.role !== "logo");
  const categoryAssignment: Record<string, ImageCategoryKey | null> =
    availableCategories.length > 0 && matchableJobs.length > 0
      ? await matchImagesToCategories(
          matchableJobs.map((j): CategoryImageTarget => ({ id: j.id, alt: j.alt })),
          availableCategories.map((key) => ({ key, sampleUrl: uploadedImages[key]![0] }))
        )
      : {};

  const categoryCursors: Partial<Record<ImageCategoryKey, number>> = {};
  function nextUploadedUrl(category: ImageCategoryKey): string | undefined {
    const urls = uploadedImages[category];
    if (!urls || urls.length === 0) return undefined;
    const cursor = categoryCursors[category] ?? 0;
    if (cursor >= urls.length) return undefined;
    categoryCursors[category] = cursor + 1;
    return urls[cursor];
  }

  const staffForcedUrls = new Map<string, string>(
    (hearing.staffMembers ?? [])
      .map((m, i): [string, string | undefined] => [`staff-${i}`, m.photoUrl])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );

  const uploadedJobs: { job: ImageJob; url: string }[] = [];
  const aiJobs: ImageJob[] = [];
  for (const job of jobs) {
    const forced = staffForcedUrls.get(job.id);
    const category = categoryAssignment[job.id];
    const url = forced ?? (category ? nextUploadedUrl(category) : undefined);
    if (url) {
      uploadedJobs.push({ job, url });
    } else {
      aiJobs.push(job);
    }
  }

  const imagePaths = new Map<string, string>();
  for (const job of jobs) imagePaths.set(job.id, job.path);

  const [aiImageFiles, uploadedImageFiles] = await Promise.all([
    mapWithConcurrency(aiJobs, IMAGE_CONCURRENCY, async (job, index) => ({
      job,
      buffer: await generateSiteImage(hearing, {
        label: job.alt || job.id,
        variationHint: `${index + 1}/${aiJobs.length}`,
        customPrompt: job.prompt,
        style: job.role,
        targetSize: job.targetSize,
      }),
    })),
    Promise.all(
      uploadedJobs.map(async ({ job, url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`アップロード画像の取得に失敗しました（${url}）。`);
        return { job, buffer: Buffer.from(await res.arrayBuffer()) };
      })
    ),
  ]);

  for (const { job, buffer } of [...aiImageFiles, ...uploadedImageFiles]) {
    await writeFile(path.join(outDir, job.path), buffer);
  }

  // --- assemble + render ---
  const vm = buildViewModel(hearing, preset, colorTheme, siteSpec, resolved, plan, imagePaths);
  const html = await renderSiteHtml(vm);
  await writeFile(path.join(outDir, "index.html"), html, "utf-8");
  await writeFile(path.join(outDir, "css", "site.css"), await readFile(SITE_CSS_SOURCE, "utf-8"), "utf-8");
  await writeFile(path.join(outDir, "js", "main.js"), await readFile(SITE_JS_SOURCE, "utf-8"), "utf-8");

  return { slug: hearing.slug, previewUrl: `/generated/${hearing.slug}/index.html` };
}
