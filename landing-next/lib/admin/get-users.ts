import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AdminUserRow {
  ownerId: string;
  email: string;
  landingsCount: number;
  likesTotal: number;
  registrationsTotal: number;
  viewsTotal: number;
  bannerEventsTotal: number;
}

interface OwnerAggregate {
  ownerId: string;
  landingsCount: number;
  likesTotal: number;
  landingIds: string[];
}

async function countGrouped(
  table: "registrations" | "landing_views",
  landingIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (landingIds.length === 0) return map;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from(table)
    .select("landing_id")
    .in("landing_id", landingIds);

  for (const row of data ?? []) {
    const id = (row as { landing_id: string }).landing_id;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function bannerEventsByUser(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("usage_events")
    .select("user_id")
    .in("event_type", ["banner_start", "banner_success", "banner_error"])
    .not("user_id", "is", null);

  for (const row of data ?? []) {
    const uid = (row as { user_id: string }).user_id;
    map.set(uid, (map.get(uid) ?? 0) + 1);
  }
  return map;
}

/** Per-creator usage summary (direct DB). */
export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const admin = getSupabaseAdmin();

  const { data: landings, error } = await admin
    .from("landings_with_like_count")
    .select("id, owner_id, likes_count")
    .not("owner_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const byOwner = new Map<string, OwnerAggregate>();

  for (const row of landings ?? []) {
    const ownerId = row.owner_id as string;
    if (!byOwner.has(ownerId)) {
      byOwner.set(ownerId, {
        ownerId,
        landingsCount: 0,
        likesTotal: 0,
        landingIds: [],
      });
    }
    const agg = byOwner.get(ownerId)!;
    agg.landingsCount++;
    agg.likesTotal += row.likes_count ?? 0;
    agg.landingIds.push(row.id as string);
  }

  const allLandingIds = (landings ?? []).map((r: { id: string }) => r.id);

  const [emailMap, regByLanding, viewsByLanding, bannerByUser] =
    await Promise.all([
      resolveOwnerEmails([...byOwner.keys()]),
      countGrouped("registrations", allLandingIds),
      countGrouped("landing_views", allLandingIds),
      bannerEventsByUser(),
    ]);

  const items = [...byOwner.values()].map((agg) => {
    let registrationsTotal = 0;
    let viewsTotal = 0;
    for (const lid of agg.landingIds) {
      registrationsTotal += regByLanding.get(lid) ?? 0;
      viewsTotal += viewsByLanding.get(lid) ?? 0;
    }
    return {
      ownerId: agg.ownerId,
      email: emailMap.get(agg.ownerId) ?? "—",
      landingsCount: agg.landingsCount,
      likesTotal: agg.likesTotal,
      registrationsTotal,
      viewsTotal,
      bannerEventsTotal: bannerByUser.get(agg.ownerId) ?? 0,
    };
  });

  items.sort((a, b) => b.landingsCount - a.landingsCount);
  return items;
}
