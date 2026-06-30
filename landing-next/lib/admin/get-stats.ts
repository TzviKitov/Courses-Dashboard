import { getSupabaseAdmin } from "@/lib/supabase/server";

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export interface AdminStats {
  totalLandings: number;
  uniqueCreators: number;
  totalLikes: number;
  totalRegistrations: number;
  viewsLast7Days: number;
  viewsLast30Days: number;
  bannerEventsLast7Days: number;
  bannerEventsLast30Days: number;
  viewsByDay: { date: string; count: number }[];
  registrationsByDay: { date: string; count: number }[];
}

function bucketByDay(
  rows: { viewed_at?: string; created_at?: string }[],
  field: "viewed_at" | "created_at"
) {
  const map: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    map[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of rows) {
    const ts = row[field];
    if (!ts) continue;
    const day = ts.slice(0, 10);
    if (day in map) map[day]++;
  }
  return Object.entries(map).map(([date, count]) => ({ date, count }));
}

/** Platform KPIs for admin dashboard (direct DB, no HTTP self-fetch). */
export async function getAdminStats(): Promise<AdminStats> {
  const admin = getSupabaseAdmin();
  const since7 = daysAgoIso(7);
  const since30 = daysAgoIso(30);

  const [
    landingsRes,
    ownersRes,
    likesRes,
    registrationsRes,
    views7Res,
    views30Res,
    banner7Res,
    banner30Res,
    viewsByDayRes,
    registrationsByDayRes,
  ] = await Promise.all([
    admin.from("landings").select("id", { count: "exact", head: true }),
    admin.from("landings").select("owner_id").not("owner_id", "is", null),
    admin.from("likes").select("landing_id", { count: "exact", head: true }),
    admin.from("registrations").select("id", { count: "exact", head: true }),
    admin
      .from("landing_views")
      .select("id", { count: "exact", head: true })
      .gte("viewed_at", since7),
    admin
      .from("landing_views")
      .select("id", { count: "exact", head: true })
      .gte("viewed_at", since30),
    admin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["banner_start", "banner_success", "banner_error"])
      .gte("created_at", since7),
    admin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["banner_start", "banner_success", "banner_error"])
      .gte("created_at", since30),
    admin
      .from("landing_views")
      .select("viewed_at")
      .gte("viewed_at", since7)
      .order("viewed_at", { ascending: true }),
    admin
      .from("registrations")
      .select("created_at")
      .gte("created_at", since7)
      .order("created_at", { ascending: true }),
  ]);

  const uniqueOwners = new Set(
    (ownersRes.data ?? []).map((r: { owner_id: string }) => r.owner_id)
  );

  return {
    totalLandings: landingsRes.count ?? 0,
    uniqueCreators: uniqueOwners.size,
    totalLikes: likesRes.count ?? 0,
    totalRegistrations: registrationsRes.count ?? 0,
    viewsLast7Days: views7Res.count ?? 0,
    viewsLast30Days: views30Res.count ?? 0,
    bannerEventsLast7Days: banner7Res.count ?? 0,
    bannerEventsLast30Days: banner30Res.count ?? 0,
    viewsByDay: bucketByDay(viewsByDayRes.data ?? [], "viewed_at"),
    registrationsByDay: bucketByDay(
      registrationsByDayRes.data ?? [],
      "created_at"
    ),
  };
}
