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

const colorsFileSchema = z.object({ colorThemes: z.array(colorThemeSchema).min(1) });

/** Deliberately independent of `DesignPreset`: color is a flat, site-wide palette (hp-templates/colors.json)
 * chosen on its own, not nested under a design style — the two are separate choices in the hearing UI. */
const designPresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  notes: z.string(),
  fontFamily: z.enum(["sans", "serif"]),
  cardStyle: z.enum(["rounded", "sharp"]),
  /** "full-bleed": hero image fills the width with centered overlay text (the original look).
   * "split": image and headline sit side-by-side on a plain background — a distinctly different,
   * more editorial page structure, not just a color/font tweak. */
  heroLayout: z.enum(["full-bleed", "split"]),
  /** How department/features/facility cards are laid out — the biggest structural lever a preset has.
   * "grid": photo-topped cards in a wrapping grid (the original look).
   * "list": horizontal rows, photo beside text — editorial, denser.
   * "minimal": no photos at all, just a numbered accent + heading + text in a bordered box. */
  blockLayout: z.enum(["grid", "list", "minimal"]),
  /** Multiplies section vertical padding — "spacious" reads noticeably more airy/premium than
   * "compact" at the same content length. */
  spacing: z.enum(["compact", "spacious"]),
  mood: z.string(),
});

export type ColorTheme = z.infer<typeof colorThemeSchema>;
export type DesignPreset = z.infer<typeof designPresetSchema>;

const PRESETS_DIR = path.join(process.cwd(), "hp-templates", "presets");
const COLORS_FILE = path.join(process.cwd(), "hp-templates", "colors.json");

let cachedPresets: DesignPreset[] | null = null;
let cachedColors: ColorTheme[] | null = null;

/** Design presets are style briefs (mood, typography, card shape) extracted from the reference
 * templates under hp-templates/ — they no longer supply an HTML skeleton to fill, and no longer carry
 * their own color options (see `listColorPalette`). OpenAI generates the actual page content and
 * structure fresh for every clinic; a preset only steers writing tone and a couple of layout knobs
 * (see generateContentPlan / renderSiteHtml). */
export function listDesignPresets(): DesignPreset[] {
  if (cachedPresets) return cachedPresets;
  const files = readdirSync(PRESETS_DIR).filter((f) => f.endsWith(".json"));
  cachedPresets = files
    .map((file) => designPresetSchema.parse(JSON.parse(readFileSync(path.join(PRESETS_DIR, file), "utf-8"))))
    .sort((a, b) => a.id.localeCompare(b.id));
  return cachedPresets;
}

export function getDesignPreset(id: string): DesignPreset | undefined {
  return listDesignPresets().find((p) => p.id === id);
}

/** The site-wide color palette (hp-templates/colors.json) — independent of which design preset is
 * chosen. Every color is available regardless of preset. */
export function listColorPalette(): ColorTheme[] {
  if (cachedColors) return cachedColors;
  const raw = colorsFileSchema.parse(JSON.parse(readFileSync(COLORS_FILE, "utf-8")));
  cachedColors = raw.colorThemes;
  return cachedColors;
}

export function getColorTheme(colorThemeId: string): ColorTheme {
  const palette = listColorPalette();
  return palette.find((t) => t.id === colorThemeId) ?? palette[0];
}
