export const IMAGE_CATEGORIES = [
  { key: "exterior", label: "外部写真" },
  { key: "interior", label: "内部写真" },
  { key: "equipment", label: "治療機器" },
  { key: "director", label: "院長写真" },
  { key: "atmosphere", label: "治療雰囲気写真" },
] as const;

export type ImageCategoryKey = (typeof IMAGE_CATEGORIES)[number]["key"];

export function isImageCategoryKey(value: string): value is ImageCategoryKey {
  return IMAGE_CATEGORIES.some((c) => c.key === value);
}
