import { getAdminLandings } from "@/lib/admin/get-landings";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { isSupabaseDbEnabled } from "@/lib/supabase/server";

/**
 * GET /api/admin/landings — all landings with owner email and engagement counts.
 */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Supabase DB is not enabled." },
      { status: 503 }
    );
  }

  try {
    const items = await getAdminLandings();
    return Response.json({ success: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
