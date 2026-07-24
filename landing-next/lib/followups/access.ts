import type { User } from "@supabase/supabase-js";
import { canManageLanding } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LandingRow } from "@/lib/supabase/types";

export const REGISTRATION_SELECT =
  "id, landing_id, full_name, phone, email, referral, notes, instructor_notes, cancelled_at, cancellation_reason, acceptance_status, form1_notes, form1_submitted_at, completion_status, form2_notes, form2_submitted_at, placement_status, placement_where, form3_feedback, form3_notes, form3_submitted_at, created_at";

/** Columns needed for access checks + follow-up due dates (avoid select *). */
const LANDING_ACCESS_SELECT =
  "id, owner_id, course, assets, start_date, end_date, is_public";

export async function requireLandingAccess(
  user: User,
  landingId: string
): Promise<{ landing: LandingRow } | { error: Response }> {
  const admin = getSupabaseAdmin();
  const { data: landing, error } = await admin
    .from("landings")
    .select(LANDING_ACCESS_SELECT)
    .eq("id", landingId)
    .maybeSingle();

  if (error || !landing) {
    return {
      error: Response.json({ success: false, error: "Not found" }, { status: 404 }),
    };
  }

  const row = landing as LandingRow;
  if (!canManageLanding(user, row.owner_id)) {
    return {
      error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { landing: row };
}
