import type { CourseType } from "@/types/course";

/** Calendar date in Israel (YYYY-MM-DD), matching gallery availability filters. */
export function calendarDateInIsrael(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export type LandingAvailabilityStatus = "open" | "year_round" | "ended";

/**
 * Per-course status aligned with the gallery availability filter:
 * ended → end_date before today
 * year_round → courseType is year_round and not ended
 * open → everything else that is still running
 *
 * "open_from" is a filter predicate (date picker), not a course state.
 */
export function getLandingAvailabilityStatus(opts: {
  endDate?: string | null;
  courseType?: string | null;
}): LandingAvailabilityStatus {
  const today = calendarDateInIsrael();
  if (opts.endDate && opts.endDate < today) return "ended";
  if (opts.courseType === "year_round") return "year_round";
  return "open";
}

export const AVAILABILITY_STATUS_LABEL: Record<
  LandingAvailabilityStatus,
  string
> = {
  open: "פתוח",
  year_round: "קבוע (כל השנה)",
  ended: "הסתיים",
};

export function isCourseType(value: string | null | undefined): value is CourseType {
  return value === "one_time" || value === "training" || value === "year_round";
}
