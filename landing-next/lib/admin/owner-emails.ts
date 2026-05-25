import { getSupabaseAdmin } from "@/lib/supabase/server";

const emailCache = new Map<string, string>();

/**
 * Resolve owner emails for a set of user IDs (cached per request lifecycle).
 */
export async function resolveOwnerEmails(
  ownerIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ownerIds.filter(Boolean) as string[])];
  const result = new Map<string, string>();
  const admin = getSupabaseAdmin();

  await Promise.all(
    unique.map(async (id) => {
      if (emailCache.has(id)) {
        result.set(id, emailCache.get(id)!);
        return;
      }
      const { data, error } = await admin.auth.admin.getUserById(id);
      const email = error || !data.user ? "—" : data.user.email ?? "—";
      emailCache.set(id, email);
      result.set(id, email);
    })
  );

  return result;
}
