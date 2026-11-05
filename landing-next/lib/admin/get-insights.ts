import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import type { Sector, TargetAudienceTag } from "@/lib/supabase/types";

export interface InsightsFilters {
  year?: number;
  sector?: Sector;
  audience?: TargetAudienceTag;
  ownerId?: string;
}

export interface CourseInsightRow {
  id: string;
  title: string;
  startDate: string | null;
  /** Stable key for filtering the list by instructor. */
  instructorKey: string;
  instructorName: string;
  views: number;
  /** Active registrations (cancelled excluded). */
  registrants: number;
  completed: number;
  placed: number;
  /** Completed / active registrants. Null when there are no registrants. */
  completionRate: number | null;
  /** Placed / completed. Null when nobody completed. Matches the page KPI. */
  placementRate: number | null;
}

export type CourseInsightSort =
  | "views"
  | "registrants"
  | "completion"
  | "placement"
  | "instructor";

export interface InsightsResult {
  coursesOpened: number;
  bySector: { sector: string; count: number }[];
  byAudience: { tag: string; count: number }[];
  placementRate: number | null;
  completedCount: number;
  placedCount: number;
  formFillRates: {
    form1: number | null;
    form2: number | null;
    form3: number | null;
  };
  pendingReminders: number;
  dominantInstructors: {
    ownerId: string;
    email: string;
    courses: number;
    registrants: number;
    placements: number;
  }[];
  courses: CourseInsightRow[];
}

function rateOrNull(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function instructorIdentity(
  ownerId: string | null,
  courseName: string | undefined,
  profileName: string | undefined,
  email: string | undefined
): { key: string; name: string } {
  const fromCourse = courseName?.trim().replace(/\s+/g, " ");
  const fromProfile = profileName?.trim();
  if (fromCourse) {
    return { key: `name:${fromCourse.toLowerCase()}`, name: fromCourse };
  }
  if (ownerId) {
    return {
      key: `owner:${ownerId}`,
      name: fromProfile || email || "—",
    };
  }
  return { key: "none", name: "ללא מדריך" };
}

/** Sort a copy. Null rates sink to the bottom on descending metrics. */
export function sortCourseInsights(
  courses: CourseInsightRow[],
  sort: CourseInsightSort
): CourseInsightRow[] {
  const rate = (n: number | null) => (n === null ? -1 : n);
  const byTitle = (a: CourseInsightRow, b: CourseInsightRow) =>
    a.title.localeCompare(b.title, "he");
  return [...courses].sort((a, b) => {
    switch (sort) {
      case "registrants":
        return b.registrants - a.registrants || b.views - a.views || byTitle(a, b);
      case "completion":
        return (
          rate(b.completionRate) - rate(a.completionRate) ||
          b.registrants - a.registrants ||
          byTitle(a, b)
        );
      case "placement":
        return (
          rate(b.placementRate) - rate(a.placementRate) ||
          b.completed - a.completed ||
          byTitle(a, b)
        );
      case "instructor":
        return (
          a.instructorName.localeCompare(b.instructorName, "he") ||
          b.views - a.views ||
          byTitle(a, b)
        );
      case "views":
      default:
        return b.views - a.views || b.registrants - a.registrants || byTitle(a, b);
    }
  });
}

async function resolveDisplayNames(ownerIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ownerIds.length === 0) return map;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", ownerIds);
  if (error || !data) return map;
  for (const row of data) {
    const name = (row.display_name as string | null)?.trim();
    if (name) map.set(row.id as string, name);
  }
  return map;
}

export async function getTrainingInsights(
  filters: InsightsFilters = {}
): Promise<InsightsResult> {
  const admin = getSupabaseAdmin();
  const year = filters.year ?? new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  let query = admin
    .from("landings")
    .select(
      "id, owner_id, sector, target_audience_tags, start_date, course"
    )
    .gte("start_date", from)
    .lte("start_date", to);

  if (filters.sector) query = query.eq("sector", filters.sector);
  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);

  const { data: landings, error } = await query;
  if (error) throw new Error(error.message);

  let filtered = landings ?? [];
  if (filters.audience) {
    filtered = filtered.filter((l) =>
      (l.target_audience_tags as string[] | null)?.includes(filters.audience!)
    );
  }

  const landingIds = filtered.map((l) => l.id);
  const coursesOpened = filtered.length;

  const bySectorMap = new Map<string, number>();
  const byAudienceMap = new Map<string, number>();
  for (const l of filtered) {
    const s = l.sector || "unknown";
    bySectorMap.set(s, (bySectorMap.get(s) ?? 0) + 1);
    for (const tag of (l.target_audience_tags as string[]) ?? []) {
      byAudienceMap.set(tag, (byAudienceMap.get(tag) ?? 0) + 1);
    }
  }

  let completedCount = 0;
  let placedCount = 0;
  let activeRegs = 0;
  let form1Done = 0;
  let form2CourseDone = 0;
  let form3CourseDone = 0;

  const instructorStats = new Map<
    string,
    { courses: number; registrants: number; placements: number }
  >();
  const perLanding = new Map<
    string,
    { registrants: number; completed: number; placed: number }
  >();
  const viewCounts = new Map<string, number>();

  for (const l of filtered) {
    const ownerId = l.owner_id as string | null;
    if (ownerId) {
      const st = instructorStats.get(ownerId) ?? {
        courses: 0,
        registrants: 0,
        placements: 0,
      };
      st.courses += 1;
      instructorStats.set(ownerId, st);
    }
  }

  if (landingIds.length > 0) {
    const [{ data: regs }, { data: followups }, { data: viewRows }] =
      await Promise.all([
        admin
          .from("registrations")
          .select(
            "landing_id, cancelled_at, completion_status, placement_status, form1_submitted_at"
          )
          .in("landing_id", landingIds),
        admin
          .from("landing_followups")
          .select("landing_id, form2_submitted_at, form3_submitted_at")
          .in("landing_id", landingIds),
        admin.from("landing_views").select("landing_id").in("landing_id", landingIds),
      ]);

    const regsByLanding = new Map<string, NonNullable<typeof regs>>();
    for (const r of regs ?? []) {
      const list = regsByLanding.get(r.landing_id) ?? [];
      list.push(r);
      regsByLanding.set(r.landing_id, list);
    }

    for (const row of viewRows ?? []) {
      const id = row.landing_id as string;
      viewCounts.set(id, (viewCounts.get(id) ?? 0) + 1);
    }

    for (const l of filtered) {
      const list = regsByLanding.get(l.id) ?? [];
      const active = list.filter((r) => !r.cancelled_at);
      activeRegs += active.length;
      form1Done += active.filter((r) => r.form1_submitted_at).length;
      const completed = active.filter((r) => r.completion_status === "completed");
      completedCount += completed.length;
      const placed = active.filter((r) => r.placement_status === true);
      placedCount += placed.length;
      perLanding.set(l.id, {
        registrants: active.length,
        completed: completed.length,
        placed: placed.length,
      });

      const ownerId = l.owner_id as string | null;
      if (ownerId) {
        const st = instructorStats.get(ownerId)!;
        st.registrants += active.length;
        st.placements += placed.length;
      }
    }

    form2CourseDone = (followups ?? []).filter((f) => f.form2_submitted_at).length;
    form3CourseDone = (followups ?? []).filter((f) => f.form3_submitted_at).length;
  }

  const { count: pendingReminders } = await admin
    .from("email_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .like("email_type", "reminder_%");

  const ownerIds = [...instructorStats.keys()];
  const [emailMap, nameMap] = await Promise.all([
    resolveOwnerEmails(ownerIds),
    resolveDisplayNames(ownerIds),
  ]);

  const courses: CourseInsightRow[] = filtered.map((l) => {
    const ownerId = l.owner_id as string | null;
    const course = l.course as { title?: string; instructorName?: string } | null;
    const stats = perLanding.get(l.id) ?? {
      registrants: 0,
      completed: 0,
      placed: 0,
    };
    const instructor = instructorIdentity(
      ownerId,
      course?.instructorName,
      ownerId ? nameMap.get(ownerId) : undefined,
      ownerId ? emailMap.get(ownerId) : undefined
    );
    return {
      id: l.id,
      title: course?.title?.trim() || "ללא כותרת",
      startDate: (l.start_date as string | null) ?? null,
      instructorKey: instructor.key,
      instructorName: instructor.name,
      views: viewCounts.get(l.id) ?? 0,
      registrants: stats.registrants,
      completed: stats.completed,
      placed: stats.placed,
      completionRate: rateOrNull(stats.completed, stats.registrants),
      placementRate: rateOrNull(stats.placed, stats.completed),
    };
  });

  const dominantInstructors = [...instructorStats.entries()]
    .map(([ownerId, st]) => ({
      ownerId,
      email: emailMap.get(ownerId) ?? "—",
      ...st,
    }))
    .sort((a, b) => b.placements - a.placements || b.courses - a.courses)
    .slice(0, 10);

  return {
    coursesOpened,
    bySector: [...bySectorMap.entries()].map(([sector, count]) => ({
      sector,
      count,
    })),
    byAudience: [...byAudienceMap.entries()].map(([tag, count]) => ({
      tag,
      count,
    })),
    placementRate:
      completedCount > 0 ? placedCount / completedCount : null,
    completedCount,
    placedCount,
    formFillRates: {
      form1: activeRegs > 0 ? form1Done / activeRegs : null,
      form2: coursesOpened > 0 ? form2CourseDone / coursesOpened : null,
      form3: coursesOpened > 0 ? form3CourseDone / coursesOpened : null,
    },
    pendingReminders: pendingReminders ?? 0,
    dominantInstructors,
    courses,
  };
}
