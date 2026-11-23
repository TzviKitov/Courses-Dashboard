import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/admin";
import { getProfile } from "@/lib/auth/profiles";
import { organizationsCompatible } from "@/lib/security/org-scope-rules";

export { organizationsCompatible };

export async function assertSameOrgForLanding(
  user: User,
  landingOrgId: string | null | undefined
): Promise<boolean> {
  if (isAdmin(user)) return true;
  const profile = await getProfile(user.id);
  return organizationsCompatible(profile?.organization_id, landingOrgId);
}
