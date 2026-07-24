/**
 * Course follow-up due-date helpers.
 * effective_end_date = end_date ?? start_date + 3 months
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp overflow (e.g. Jan 31 + 1 month)
  if (d.getUTCDate() < day) {
    d.setUTCDate(0);
  }
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** end_date if set, otherwise start_date + 3 months. */
export function effectiveEndDate(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): Date | null {
  const end = parseIsoDate(endDate ?? null);
  if (end) return end;
  const start = parseIsoDate(startDate ?? null);
  if (!start) return null;
  return addMonths(start, 3);
}

export type FollowupFormKind = "form1" | "form2" | "form3";

export interface FollowupDueDates {
  courseOpen: Date | null;
  form1: Date | null;
  form2: Date | null;
  form3: Date | null;
}

export function computeFollowupDueDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): FollowupDueDates {
  const start = parseIsoDate(startDate ?? null);
  const end = effectiveEndDate(startDate, endDate);
  return {
    courseOpen: start,
    form1: start ? addDays(start, 14) : null,
    form2: end ? addMonths(end, 1) : null,
    form3: end ? addMonths(end, 3) : null,
  };
}

/** True when today (UTC date) is on or after the due date. */
export function isFormWindowOpen(due: Date | null, now: Date = new Date()): boolean {
  if (!due) return false;
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  );
  const dueDay = new Date(
    Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 12)
  );
  return today.getTime() >= dueDay.getTime();
}

export function formsRequireAuth(): boolean {
  return process.env.FORMS_REQUIRE_AUTH === "true";
}

export const REGISTRATION_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const REGISTRATION_FILE_MAX_COUNT = 5;
export const REGISTRATION_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const REGISTRATION_FILES_BUCKET = "registration-files";
