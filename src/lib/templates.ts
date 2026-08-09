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
};

export type TemplateDefinition = TemplateSummary & {
  dirName: string;
  htmlFile: string;
  contentSlots: TemplateContentSlot[];
  imageSlots: TemplateImageSlot[];
  sections: TemplateSection[];
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
};

async function listTemplateDirs(): Promise<string[]> {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("tp_"))
    .map((entry) => entry.name)
    .sort();
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

/** The human-authored editing guide and the record of which sample images were removed
 * (role, original size, where each was used) — both kept out of the generated site itself,
 * but read here as reference material for the AI generation prompts. */
export async function getTemplateReferenceDocs(
  dirName: string
): Promise<{ guide: string; imageManifest: string }> {
  const [guide, imageManifest] = await Promise.all([
    readReferenceDoc(dirName, "AI_GUIDE.md"),
    readReferenceDoc(dirName, "_removed_images_manifest.md"),
  ]);
  return { guide, imageManifest };
}
