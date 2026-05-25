import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

/**
 * GET /api/admin/usage — paginated usage event log.
 * Query: type, from, to, page (1-based)
 */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Supabase DB is not enabled." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  const admin = getSupabaseAdmin();
  let query = admin
    .from("usage_events")
    .select("id, event_type, user_id, landing_id, session_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("event_type", type);
  }
  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }

  const fromIdx = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(fromIdx, fromIdx + PAGE_SIZE - 1);

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  const userIds = (data ?? []).map((r: { user_id: string | null }) => r.user_id);
  const emailMap = await resolveOwnerEmails(userIds);

  const items = (data ?? []).map(
    (row: {
      id: string;
      event_type: string;
      user_id: string | null;
      landing_id: string | null;
      session_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    }) => ({
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id,
      userEmail: row.user_id ? emailMap.get(row.user_id) ?? "—" : "—",
      landingId: row.landing_id,
      sessionId: row.session_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    })
  );

  return Response.json({
    success: true,
    items,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
