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

export type TemplateDefinition = TemplateSummary & {
  dirName: string;
  htmlFile: string;
  contentSlots: TemplateContentSlot[];
  imageSlots: TemplateImageSlot[];
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
