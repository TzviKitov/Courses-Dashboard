import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profiles";
import {
  checkCoGuideCandidate,
  normalizeEmail,
  type CoGuideCheck,
} from "@/lib/landings/co-guide-rules";

export interface CoGuideInfo {
  userId: string;
  name: string | null;
  email: string | null;
}

/** Auth admin API has no lookup by email, so scan pages like the accounts list does. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function listCoGuides(landingId: string): Promise<CoGuideInfo[]> {
  const admin = getSupabaseAdmin();
  const { data: rows } = await admin
    .from("landing_instructors")
    .select("user_id")
    .eq("landing_id", landingId);
  const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const names = new Map(
    (profiles ?? []).map((p: { id: string; display_name: string | null }) => [
      p.id,
      p.display_name,
    ])
  );

  return Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return {
        userId: id,
        name: names.get(id) ?? null,
        email: data?.user?.email ?? null,
      };
    })
  );
}

/** Add an existing active guide as co-guide. The caller must already be allowed to do this. */
export async function addCoGuideByEmail(opts: {
  landingId: string;
  email: unknown;
  addedBy: string;
}): Promise<CoGuideCheck & { guide?: CoGuideInfo }> {
  const email = normalizeEmail(opts.email);
  if (!email) return { ok: false, error: "כתובת המייל לא תקינה." };

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("id, owner_id, organization_id")
    .eq("id", opts.landingId)
    .maybeSingle();
  if (!landing) return { ok: false, error: "הקורס לא נמצא." };

  const userId = await findUserIdByEmail(email);
  const profile = userId ? await getProfile(userId) : null;
  const check = checkCoGuideCandidate(
    profile && userId
      ? {
          userId,
          role: profile.role,
          status: profile.status,
          organizationId: profile.organization_id,
        }
      : null,
    { ownerId: landing.owner_id, landingOrgId: landing.organization_id }
  );
  if (!check.ok) return check;
  if (!userId) return { ok: false, error: "שגיאה בחיפוש המדריך." };

  const { error } = await admin.from("landing_instructors").upsert({
    landing_id: opts.landingId,
    user_id: userId,
    created_by: opts.addedBy,
  });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    guide: { userId, name: profile?.display_name ?? null, email },
  };
}

export async function removeCoGuide(
  landingId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("landing_instructors")
    .delete()
    .eq("landing_id", landingId)
    .eq("user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
