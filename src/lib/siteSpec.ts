import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";

const structuralSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  notes: z.string().optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.literal("body"),
  order: z.number(),
  removable: z.boolean(),
  defaultVisible: z.boolean(),
  content: z
    .object({
      aiAuthored: z.boolean().optional(),
      drivenBy: z.array(z.string()).optional(),
      tone: z.string().optional(),
      source: z.string().optional(),
      hideIfEmpty: z.boolean().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  images: z
    .object({
      count: z.union([z.string(), z.number()]).optional(),
      role: z.enum(["logo", "photo", "icon"]).optional(),
      aspect: z.string().optional(),
    })
    .optional(),
  repeatable: z
    .object({
      source: z.string(),
      fallback: z.enum(["ai", "hide"]),
      min: z.number(),
      max: z.number(),
      notes: z.string().optional(),
    })
    .optional(),
});

const siteSpecSchema = z.object({
  structuralSections: z.array(structuralSectionSchema),
  sections: z.array(sectionSchema),
  reservation: z.object({ channels: z.array(z.string()), note: z.string() }),
  seo: z.object({ fields: z.array(z.string()), descriptionLength: z.string(), notes: z.string().optional() }),
  nav: z.object({ derivedFrom: z.string(), footerColumns: z.string() }),
  branding: z.object({
    logo: z.object({
      format: z.string(),
      background: z.string(),
      size: z.object({ width: z.number(), height: z.number() }),
      rule: z.string(),
    }),
  }),
  imageStyleRules: z.array(z.string()),
  honestyRules: z.array(z.string()),
});

export type SiteSpecSection = z.infer<typeof sectionSchema>;
export type SiteSpecStructuralSection = z.infer<typeof structuralSectionSchema>;
export type SiteSpec = z.infer<typeof siteSpecSchema>;

/** section ids that are never AI-authored copy — either fixed structural chrome (header/hero/footer)
 * or a `content.aiAuthored: false` / `repeatable` body section whose values come straight from the
 * hearing sheet. Kept in sync with SITE_SPEC.json rather than hardcoded, so a future spec change
 * doesn't silently go stale here. */
export function isAiAuthoredSection(section: SiteSpecSection): boolean {
  if (section.repeatable) return false;
  return section.content?.aiAuthored !== false;
}

let cached: SiteSpec | null = null;

/** SITE_SPEC.json is the single source of truth for which sections a generated clinic site must
 * have, their default order, and the content/image/repeatable-group rules that govern them —
 * independent of which design preset (colors/mood) the user picks. See hp-templates/TEMPLATE_VARIABLES.md. */
export function getSiteSpec(): SiteSpec {
  if (cached) return cached;
  const raw = readFileSync(path.join(process.cwd(), "hp-templates", "SITE_SPEC.json"), "utf-8");
  cached = siteSpecSchema.parse(JSON.parse(raw));
  return cached;
}

/** Body sections in their declared default order — what `SectionOrderEditor` initializes from. */
export function getBodySections(): SiteSpecSection[] {
  return [...getSiteSpec().sections].sort((a, b) => a.order - b.order);
}

export function getSection(id: string): SiteSpecSection | undefined {
  return getSiteSpec().sections.find((s) => s.id === id);
}
