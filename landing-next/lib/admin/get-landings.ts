import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AdminLandingRow {
  id: string;
  title: string;
  description: string;
  bannerThumbUrl?: string;
  startDate: string | null;
  isPublic: boolean;
  createdAt: string;
  ownerEmail: string;
  likesCount: number;
  registrationsCount: number;
  viewsCount: number;
}

async function countByLanding(
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

/** All landings with owner email and engagement counts (direct DB). */
export async function getAdminLandings(): Promise<AdminLandingRow[]> {
  const admin = getSupabaseAdmin();

  const { data: landings, error } = await admin
    .from("landings_with_like_count")
    .select(
      "id, course, assets, start_date, is_public, created_at, owner_id, likes_count"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const ids = (landings ?? []).map((l: { id: string }) => l.id);
  const ownerIds = (landings ?? []).map(
    (l: { owner_id: string | null }) => l.owner_id
  );

  const [emailMap, regCounts, viewCounts] = await Promise.all([
    resolveOwnerEmails(ownerIds),
    countByLanding("registrations", ids),
    countByLanding("landing_views", ids),
  ]);

  return (landings ?? []).map(
    (row: {
      id: string;
      course: { title?: string; description?: string };
      assets: { bannerThumbUrl?: string };
      start_date: string | null;
      is_public: boolean;
      created_at: string;
      owner_id: string | null;
      likes_count?: number;
    }) => ({
      id: row.id,
      title: row.course?.title || "",
      description: row.course?.description || "",
      bannerThumbUrl: row.assets?.bannerThumbUrl,
      startDate: row.start_date,
      isPublic: row.is_public,
      createdAt: row.created_at,
      ownerEmail: row.owner_id ? emailMap.get(row.owner_id) ?? "—" : "—",
      likesCount: row.likes_count ?? 0,
      registrationsCount: regCounts.get(row.id) ?? 0,
      viewsCount: viewCounts.get(row.id) ?? 0,
    })
  );
}
