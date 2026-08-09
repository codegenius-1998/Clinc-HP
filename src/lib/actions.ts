"use server";

import { redirect } from "next/navigation";
import { listTemplates } from "./templates";
import { saveHearing } from "./hearing";

export type HearingFormState = {
  error: string | null;
};

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createHearingAction(
  _prevState: HearingFormState,
  formData: FormData
): Promise<HearingFormState> {
  const clinicName = requiredField(formData, "clinicName");
  const templateId = requiredField(formData, "templateId");
  const colorScheme = requiredField(formData, "colorScheme");

  if (!clinicName) {
    return { error: "クリニック名を入力してください。" };
  }
  if (!templateId || !colorScheme) {
    return { error: "テンプレートとカラーを選択してください。" };
  }

  const templates = await listTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return { error: "選択されたテンプレートが見つかりません。" };
  }
  const colorSchemeOption = template.colorSchemes.find((c) => c.id === colorScheme);

  const hearing = await saveHearing({
    templateId: template.id,
    templateLabel: template.label,
    colorScheme,
    colorSchemeLabel: colorSchemeOption?.label ?? colorScheme,
    clinicName,
    directorName: requiredField(formData, "directorName"),
    address: requiredField(formData, "address"),
    phone: requiredField(formData, "phone"),
    line: requiredField(formData, "line"),
    hours: requiredField(formData, "hours"),
    features: requiredField(formData, "features"),
    request: requiredField(formData, "request"),
  });

  redirect(`/sites/${hearing.slug}`);
}
