import type { User } from "@supabase/supabase-js";
import { userCanManageLanding } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertSameOrgForLanding } from "@/lib/security/org-scope";
import {
  REGISTRATION_SELECT_SAFE,
  REGISTRATION_SELECT_WITH_NOTES,
} from "@/lib/security/sensitive-notes";
import type { LandingRow } from "@/lib/supabase/types";

/** Safe default (no sensitive notes). Prefer this for list APIs. */
export const REGISTRATION_SELECT = REGISTRATION_SELECT_SAFE;
export { REGISTRATION_SELECT_WITH_NOTES };

/** Columns needed for access checks + follow-up due dates (avoid select *). */
const LANDING_ACCESS_SELECT =
  "id, owner_id, organization_id, course, assets, start_date, end_date, is_public";

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
  if (!(await assertSameOrgForLanding(user, row.organization_id))) {
    return {
      error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  if (!(await userCanManageLanding(user, landingId, row.owner_id))) {
    return {
      error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { landing: row };
}
