import { getAdminStats } from "@/lib/admin/get-stats";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { isSupabaseDbEnabled } from "@/lib/supabase/server";

/**
 * GET /api/admin/stats — platform KPIs for admin dashboard.
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
    const stats = await getAdminStats();
    return Response.json({ success: true, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
