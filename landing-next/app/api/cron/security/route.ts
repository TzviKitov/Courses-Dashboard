import { isSupabaseDbEnabled, getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/provider";
import { logAuditEvent } from "@/lib/security/audit";
import { pruneRateLimitEvents } from "@/lib/security/rate-limit";
import { pruneAuditEventsOlderThanRetention } from "@/lib/security/audit";

/**
 * GET /api/cron/security
 * Daily: prune rate limits, check anomalies, email admin.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "DB disabled" }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ count: loginFails }, { count: exportsCount }, { count: views }] =
    await Promise.all([
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("action", "login_failure")
        .gte("created_at", since),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("action", "export_csv")
        .gte("created_at", since),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("action", "view_notes")
        .gte("created_at", since),
    ]);

  const alerts: string[] = [];
  if ((loginFails ?? 0) >= 20) {
    alerts.push(`כשלונות התחברות ב-24ש: ${loginFails}`);
  }
  if ((exportsCount ?? 0) >= 10) {
    alerts.push(`ייצואי CSV ב-24ש: ${exportsCount}`);
  }
  if ((views ?? 0) >= 80) {
    alerts.push(`צפיות בהערות רגישות ב-24ש: ${views}`);
  }

  if (alerts.length) {
    logAuditEvent({
      action: "security_alert",
      metadata: { alerts },
    });
    const to = process.env.SECURITY_ALERT_EMAIL || process.env.EMAIL_FROM;
    if (to && !to.includes("onboarding@resend.dev")) {
      await sendEmail({
        to: to.replace(/.*<|>/g, "") || to,
        subject: "CourseFlow — התראת אבטחה יומית",
        html: `<p>${alerts.map((a) => a.replace(/</g, "")).join("<br/>")}</p>`,
        text: alerts.join("\n"),
      });
    }
  }

  const prunedRl = await pruneRateLimitEvents(48);
  const prunedAudit = await pruneAuditEventsOlderThanRetention();

  return Response.json({
    success: true,
    loginFails: loginFails ?? 0,
    exportsCount: exportsCount ?? 0,
    noteViews: views ?? 0,
    alerts,
    prunedRl,
    prunedAudit,
  });
}
