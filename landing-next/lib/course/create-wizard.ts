export const COURSE_CREATE_STEP_KEY = "courseCreateStep";

export const CREATE_WIZARD_STEPS = [
  { id: 1, label: "פרטי הקורס" },
  { id: 2, label: "קהל ולוח זמנים" },
  { id: 3, label: "עיצוב ובאנר" },
  { id: 4, label: "הגדרות דף נחיתה" },
] as const;

export type CreateWizardStepIndex = 0 | 1 | 2;

export function parseCreateWizardStep(raw: string | null): CreateWizardStepIndex {
  const n = Number(raw);
  if (n === 1 || n === 2) return n;
  return 0;
}
