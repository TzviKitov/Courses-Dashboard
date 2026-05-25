import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

/**
 * GET /api/admin/landings — all landings with owner email and engagement counts.
 */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Supabase DB is not enabled." },
      { status: 503 }
    );
  }

  const admin = getSupabaseAdmin();

  const { data: landings, error } = await admin
    .from("landings_with_like_count")
    .select(
      "id, course, assets, start_date, is_public, created_at, owner_id, likes_count"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  const ids = (landings ?? []).map((l: { id: string }) => l.id);
  const ownerIds = (landings ?? []).map((l: { owner_id: string | null }) => l.owner_id);

  const [emailMap, regCounts, viewCounts] = await Promise.all([
    resolveOwnerEmails(ownerIds),
    countByLanding(admin, "registrations", ids),
    countByLanding(admin, "landing_views", ids),
  ]);

  const items = (landings ?? []).map(
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
      ownerId: row.owner_id,
      ownerEmail: row.owner_id ? emailMap.get(row.owner_id) ?? "—" : "—",
      likesCount: row.likes_count ?? 0,
      registrationsCount: regCounts.get(row.id) ?? 0,
      viewsCount: viewCounts.get(row.id) ?? 0,
    })
  );

  return Response.json({ success: true, items });
}

async function countByLanding(
  admin: ReturnType<typeof getSupabaseAdmin>,
  table: "registrations" | "landing_views",
  landingIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (landingIds.length === 0) return map;

  const column = table === "registrations" ? "landing_id" : "landing_id";
  const { data } = await admin.from(table).select(column).in(column, landingIds);

  for (const row of data ?? []) {
    const id = (row as { landing_id: string }).landing_id;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}
