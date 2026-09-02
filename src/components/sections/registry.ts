import type { ComponentType } from "react";
import type { SectionType } from "./data/sections";

import { HeaderBar } from "./Header/Header";
import { HeroFullBleed } from "./Hero/HeroFullBleed";
import { ScheduleTable } from "./Schedule/Schedule";
import { NewsList } from "./News/News";
import { ReasonsNumbered } from "./Reasons/Reasons";
import { GreetingPortrait } from "./Greeting/Greeting";
import { PhilosophyCentered } from "./Philosophy/Philosophy";
import { MedicalGrid } from "./Medical/Medical";
import { FeesTable } from "./Fees/Fees";
import { FlowSteps } from "./Flow/Flow";
import { FaqAccordion } from "./Faq/Faq";
import { AccessMapSide } from "./Access/Access";
import { ContactCta } from "./Contact/Contact";
import { FooterBand } from "./Footer/Footer";

/** type + variant → コンポーネント。
 *
 * 同じ役割のセクションを別デザインで持てる構造(prompt §11)。variant を増やすときは、
 * `<Type>/<Type><Variant>.tsx` を作ってここに1行足すだけ。data/sections.ts の layout で
 * どの variant を使うか宣言する。未登録の組み合わせは registry.ts が握りつぶして描画しない。 */
export const REGISTRY: Record<string, ComponentType> = {
  "header:bar": HeaderBar,

  "hero:full-bleed": HeroFullBleed,

  "schedule:table": ScheduleTable,
  "news:list": NewsList,
  "reasons:numbered": ReasonsNumbered,
  "greeting:portrait": GreetingPortrait,
  "philosophy:centered": PhilosophyCentered,
  "medical:grid": MedicalGrid,
  "fees:table": FeesTable,
  "flow:steps": FlowSteps,
  "faq:accordion": FaqAccordion,
  "access:map-side": AccessMapSide,
  "contact:cta": ContactCta,
  "footer:band": FooterBand,
};

export function resolveSection(type: SectionType, variant: string): ComponentType | null {
  return REGISTRY[`${type}:${variant}`] ?? null;
}
