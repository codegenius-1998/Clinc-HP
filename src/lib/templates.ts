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

const TEMPLATES_DIR = path.join(process.cwd(), "hp-templates");

type RawVariablesJson = {
  templateId: string;
  meta?: { label?: string; notes?: string };
  colorScheme?: {
    active?: string;
    options?: Record<string, { label?: string }>;
  };
};

export async function listTemplates(): Promise<TemplateSummary[]> {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  const templateDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("tp_"))
    .map((entry) => entry.name)
    .sort();

  const templates = await Promise.all(
    templateDirs.map(async (dirName): Promise<TemplateSummary | null> => {
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
          label: data.meta?.label ?? dirName,
          notes: data.meta?.notes,
          colorSchemes,
          defaultColorScheme: data.colorScheme?.active ?? colorSchemes[0]?.id ?? "",
        };
      } catch {
        return null;
      }
    })
  );

  return templates.filter((t): t is TemplateSummary => t !== null);
}
