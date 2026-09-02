import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/admin";
import { getProfile } from "@/lib/auth/profiles";

/** When both sides have an org, they must match. Null skips (legacy rows). Admins bypass. */
export function organizationsCompatible(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return true;
  return a === b;
}

export async function assertSameOrgForLanding(
  user: User,
  landingOrgId: string | null | undefined
): Promise<boolean> {
  if (isAdmin(user)) return true;
  const profile = await getProfile(user.id);
  return organizationsCompatible(profile?.organization_id, landingOrgId);
}
