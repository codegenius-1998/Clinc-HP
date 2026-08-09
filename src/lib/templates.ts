import { readFile, readdir } from "fs/promises";
import path from "path";

export type TemplateColorScheme = {
  id: string;
  label: string;
};

export type TemplateSummary = {
  id: string;
  label: string;
  notes?: string;
  colorSchemes: TemplateColorScheme[];
  defaultColorScheme: string;
};

export type TemplateContentSlot = {
  id: string;
  label: string;
  selector: string;
  type: string;
  source?: string;
};

export type TemplateImageSlot = {
  id: string;
  label: string;
  path: string;
  selector: string;
};

export type TemplateSection = {
  id: string;
  label: string;
  selector: string;
  visible: boolean;
  navHrefs: string[];
  removable: boolean;
  description?: string;
};

export type TemplateLayoutKnob = {
  label: string;
  value: string | number;
  cssVar: string;
  min?: number;
  max?: number;
};

export type TemplateLinkSlot = {
  id: string;
  label: string;
  selector: string;
  /** e.g. "tel:{phone}" / "https://line.me/R/ti/p/{line}" — {field} placeholders map to HearingSheet fields. */
  href: string | null;
  /** Which hearing field (if any) feeds this link, or a fixed policy like "hide-if-missing". */
  connect: string;
};

export type TemplateVirtualMaterialTarget = {
  id: string;
  label: string;
  selector: string;
  /** "hide" always; "hide-if-no-address" / "hide-if-no-staff-data" conditional; "replace-or-hide" handled elsewhere. */
  action: string;
  reason?: string;
};

export type TemplateDefinition = TemplateSummary & {
  dirName: string;
  htmlFile: string;
  contentSlots: TemplateContentSlot[];
  imageSlots: TemplateImageSlot[];
  sections: TemplateSection[];
  layout: Record<string, TemplateLayoutKnob>;
  customCssFile: string;
  linkSlots: TemplateLinkSlot[];
  virtualMaterialTargets: TemplateVirtualMaterialTarget[];
  /** Raw sectionGuide/imageGuide/textGuide/linkGuide objects (if the template declares them) — fed to the
   * AI generation prompts as structured reference material. This is variables.json's own documentation of
   * itself, and takes priority over any separate AI_GUIDE.md (older templates only, and no longer read). */
  guideSummary: string;
};

export const TEMPLATES_DIR = path.join(process.cwd(), "hp-templates");

type RawVariablesJson = {
  templateId: string;
  meta?: { label?: string; notes?: string; htmlFile?: string };
  colorScheme?: {
    active?: string;
    options?: Record<string, { label?: string }>;
  };
  contentSlots?: TemplateContentSlot[];
  imageSlots?: TemplateImageSlot[];
  sections?: TemplateSection[];
  layout?: Record<string, TemplateLayoutKnob>;
  customCss?: { file?: string };
  linkSlots?: TemplateLinkSlot[];
  virtualMaterials?: { targets?: TemplateVirtualMaterialTarget[] };
  sectionGuide?: unknown;
  imageGuide?: unknown;
  textGuide?: unknown;
  linkGuide?: unknown;
};

/** A template directory is anything under hp-templates/ with a variables.json + the HTML file it declares
 * — no naming convention required (older Template Party imports used a "tp_" prefix; hand-authored
 * templates like template0001 don't). */
async function listTemplateDirs(): Promise<string[]> {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  const dirNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const checked = await Promise.all(
    dirNames.map(async (name) => {
      try {
        await readFile(path.join(TEMPLATES_DIR, name, "variables.json"), "utf-8");
        return name;
      } catch {
        return null;
      }
    })
  );
  return checked.filter((name): name is string => name !== null).sort();
}

function buildGuideSummary(data: RawVariablesJson): string {
  const parts: Record<string, unknown> = {};
  if (data.sectionGuide) parts.sectionGuide = data.sectionGuide;
  if (data.imageGuide) parts.imageGuide = data.imageGuide;
  if (data.textGuide) parts.textGuide = data.textGuide;
  if (data.linkGuide) parts.linkGuide = data.linkGuide;
  return Object.keys(parts).length > 0 ? JSON.stringify(parts, null, 2) : "";
}

async function readTemplateDefinition(dirName: string): Promise<TemplateDefinition | null> {
  try {
    const raw = await readFile(path.join(TEMPLATES_DIR, dirName, "variables.json"), "utf-8");
    const data = JSON.parse(raw) as RawVariablesJson;
    const options = data.colorScheme?.options ?? {};
    const colorSchemes: TemplateColorScheme[] = Object.entries(options).map(([id, option]) => ({
      id,
      label: option.label ?? id,
    }));

    return {
      id: data.templateId ?? dirName,
      dirName,
      label: data.meta?.label ?? dirName,
      notes: data.meta?.notes,
      htmlFile: data.meta?.htmlFile ?? "index.html",
      colorSchemes,
      defaultColorScheme: data.colorScheme?.active ?? colorSchemes[0]?.id ?? "",
      contentSlots: data.contentSlots ?? [],
      imageSlots: data.imageSlots ?? [],
      sections: data.sections ?? [],
      layout: data.layout ?? {},
      customCssFile: data.customCss?.file ?? "css/custom.css",
      linkSlots: data.linkSlots ?? [],
      virtualMaterialTargets: data.virtualMaterials?.targets ?? [],
      guideSummary: buildGuideSummary(data),
    };
  } catch {
    return null;
  }
}

export async function listTemplates(): Promise<TemplateDefinition[]> {
  const templateDirs = await listTemplateDirs();
  const templates = await Promise.all(templateDirs.map(readTemplateDefinition));
  return templates.filter((t): t is TemplateDefinition => t !== null);
}

export async function getTemplateDefinition(templateId: string): Promise<TemplateDefinition | null> {
  const templateDirs = await listTemplateDirs();
  for (const dirName of templateDirs) {
    const def = await readTemplateDefinition(dirName);
    if (def && def.id === templateId) {
      return def;
    }
  }
  return null;
}

const MAX_REFERENCE_DOC_LENGTH = 20000;

async function readReferenceDoc(dirName: string, fileName: string): Promise<string> {
  try {
    const raw = await readFile(path.join(TEMPLATES_DIR, dirName, fileName), "utf-8");
    return raw.length > MAX_REFERENCE_DOC_LENGTH ? raw.slice(0, MAX_REFERENCE_DOC_LENGTH) : raw;
  } catch {
    return "";
  }
}

/** The removed-images manifest (role/size/original references of deleted sample images) is still
 * useful supplementary context for image prompts. AI_GUIDE.md is deliberately NOT read here —
 * newer templates declare `meta.notes: "AI_GUIDE.md は使わない"` and put the same guidance directly
 * in variables.json's own sectionGuide/imageGuide/textGuide (see `guideSummary` on TemplateDefinition),
 * which is more reliable than parsing free-form markdown. */
export async function getTemplateImageManifest(dirName: string): Promise<string> {
  return readReferenceDoc(dirName, "_removed_images_manifest.md");
}
