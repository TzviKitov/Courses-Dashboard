import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/auth/types";

export interface AdminAccountRow extends ProfileRow {
  email: string | null;
  landingsCount: number;
}

export async function listAdminAccounts(): Promise<AdminAccountRow[]> {
  const admin = getSupabaseAdmin();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, display_name, role, status, can_view_all_learners, can_export_registrants, can_view_sensitive_notes, can_export_sensitive_notes, organization_id, last_seen_at, phone, created_via, requested_all_learners_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const { data: landings } = await admin
    .from("landings")
    .select("owner_id")
    .not("owner_id", "is", null);

  const countByOwner = new Map<string, number>();
  for (const row of landings ?? []) {
    const oid = row.owner_id as string;
    countByOwner.set(oid, (countByOwner.get(oid) ?? 0) + 1);
  }

  const emailById = new Map<string, string | null>();
  // Batch via auth admin list (paginated)
  let page = 1;
  for (;;) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) break;
    for (const u of data.users) {
      emailById.set(u.id, u.email ?? null);
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 20) break;
  }

  return (profiles as unknown as ProfileRow[]).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
    landingsCount: countByOwner.get(p.id) ?? 0,
  }));
}
