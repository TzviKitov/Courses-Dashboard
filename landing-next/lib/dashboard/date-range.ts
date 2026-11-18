/**
 * Whether a course was active for at least one day in an inclusive date range.
 * A missing end date means the course is ongoing. Courses without a known
 * start date are excluded because their activity period cannot be established.
 */
export function courseOverlapsDateRange(
  courseStart: string | null,
  courseEnd: string | null,
  rangeStart?: string,
  rangeEnd?: string
): boolean {
  if (!rangeStart && !rangeEnd) return true;
  if (!courseStart) return false;
  if (rangeEnd && courseStart > rangeEnd) return false;
  if (rangeStart && courseEnd && courseEnd < rangeStart) return false;
  return true;
}
