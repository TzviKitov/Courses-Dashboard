import { getAdminUsage } from "@/lib/admin/get-usage";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { isSupabaseDbEnabled } from "@/lib/supabase/server";

/**
 * GET /api/admin/usage — paginated usage event log.
 * Query: type, from, to, page (1-based)
 */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Supabase DB is not enabled." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);

  try {
    const result = await getAdminUsage({
      type: url.searchParams.get("type") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      page: Math.max(1, parseInt(url.searchParams.get("page") || "1", 10)),
    });
    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
