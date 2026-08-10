import { readFileSync, readdirSync } from "fs";
import path from "path";
import { z } from "zod";

const colorThemeSchema = z.object({
  id: z.string(),
  label: z.string(),
  tokens: z.object({
    primary: z.string(),
    accent: z.string(),
    light: z.string(),
    primaryInverse: z.string().optional(),
    accentInverse: z.string().optional(),
  }),
});

const designPresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  notes: z.string(),
  colorThemes: z.array(colorThemeSchema).min(1),
  defaultColorTheme: z.string(),
  fontFamily: z.enum(["sans", "serif"]),
  cardStyle: z.enum(["rounded", "sharp"]),
  mood: z.string(),
});

export type ColorTheme = z.infer<typeof colorThemeSchema>;
export type DesignPreset = z.infer<typeof designPresetSchema>;

const PRESETS_DIR = path.join(process.cwd(), "hp-templates", "presets");

let cached: DesignPreset[] | null = null;

/** Design presets are style briefs (color themes, mood, typography) extracted from the reference
 * templates under hp-templates/ — they no longer supply an HTML skeleton to fill. OpenAI generates
 * the actual page content and structure fresh for every clinic; a preset only steers its color theme
 * choice and writing tone (see generateContentPlan). */
export function listDesignPresets(): DesignPreset[] {
  if (cached) return cached;
  const files = readdirSync(PRESETS_DIR).filter((f) => f.endsWith(".json"));
  cached = files
    .map((file) => designPresetSchema.parse(JSON.parse(readFileSync(path.join(PRESETS_DIR, file), "utf-8"))))
    .sort((a, b) => a.id.localeCompare(b.id));
  return cached;
}

export function getDesignPreset(id: string): DesignPreset | undefined {
  return listDesignPresets().find((p) => p.id === id);
}

export function getColorTheme(preset: DesignPreset, colorThemeId: string): ColorTheme {
  return preset.colorThemes.find((t) => t.id === colorThemeId) ?? preset.colorThemes[0];
}
