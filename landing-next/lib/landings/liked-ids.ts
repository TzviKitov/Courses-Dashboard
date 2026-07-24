import { cookies } from "next/headers";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

const ANON_COOKIE = "lg_anon_id";

/**
 * Which of the given landing IDs the current anonymous visitor has liked.
 * One query for the whole gallery (instead of N per-tile /likes requests).
 */
export async function getLikedLandingIds(
  landingIds: string[]
): Promise<Set<string>> {
  if (!isSupabaseDbEnabled() || landingIds.length === 0) {
    return new Set();
  }

  const store = await cookies();
  const anonId = store.get(ANON_COOKIE)?.value;
  if (!anonId) return new Set();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("likes")
    .select("landing_id")
    .eq("identity", anonId)
    .in("landing_id", landingIds);

  if (error || !data) return new Set();
  return new Set(data.map((row) => row.landing_id as string));
}
