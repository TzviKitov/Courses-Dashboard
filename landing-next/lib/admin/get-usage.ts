import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export interface AdminUsageRow {
  id: string;
  eventType: string;
  userId: string | null;
  userEmail: string;
  landingId: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUsageResult {
  items: AdminUsageRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUsageParams {
  type?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** Paginated usage event log (direct DB). */
export async function getAdminUsage(
  params: AdminUsageParams = {}
): Promise<AdminUsageResult> {
  const page = Math.max(1, params.page ?? 1);
  const admin = getSupabaseAdmin();

  let query = admin
    .from("usage_events")
    .select("id, event_type, user_id, landing_id, session_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (params.type) query = query.eq("event_type", params.type);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);

  const fromIdx = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(
    fromIdx,
    fromIdx + PAGE_SIZE - 1
  );

  if (error) {
    throw new Error(error.message);
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

  const total = count ?? 0;
  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}
