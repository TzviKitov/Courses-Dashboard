import { isSupabaseDbEnabled } from "@/lib/supabase/server";
import { runFollowupCron } from "@/lib/email/cron";

/**
 * GET /api/cron/followups
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Supabase DB disabled" },
      { status: 503 }
    );
  }

  try {
    const result = await runFollowupCron();
    return Response.json({ success: true, ...result });
  } catch (e) {
    console.error("followup cron failed:", e);
    return Response.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "cron failed",
      },
      { status: 500 }
    );
  }
}
