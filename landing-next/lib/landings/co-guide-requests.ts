import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/landings/co-guide-rules";
import { grantCoGuide } from "@/lib/landings/co-guides";
import { logAuditEvent } from "@/lib/security/audit";

export interface CoGuideRequestRow {
  id: string;
  landing_id: string;
  email: string;
  display_name: string | null;
  requested_by: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

const MISSING_TABLE_HINT =
  "טבלת הבקשות עדיין לא קיימת במסד הנתונים. צריך להריץ את db/schema-co-guide-requests.sql.";

function dbError(message: string, code?: string): string {
  if (code === "42P01" || /co_guide_requests/.test(message)) return MISSING_TABLE_HINT;
  return message;
}

/** A guide asks for another guide to be invited to the course. An admin decides. */
export async function createCoGuideRequest(opts: {
  landingId: string;
  email: unknown;
  displayName?: unknown;
  requestedBy: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(opts.email);
  if (!email) return { ok: false, error: "כתובת המייל לא תקינה." };
  const displayName =
    typeof opts.displayName === "string"
      ? opts.displayName.trim().slice(0, 80) || null
      : null;

  const { error } = await getSupabaseAdmin().from("co_guide_requests").insert({
    landing_id: opts.landingId,
    email,
    display_name: displayName,
    requested_by: opts.requestedBy,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "כבר נשלחה בקשה למדריך הזה בקורס. היא ממתינה לאישור." };
    }
    return { ok: false, error: dbError(error.message, error.code) };
  }
  return { ok: true };
}

export async function listPendingRequests(
  landingId?: string
): Promise<CoGuideRequestRow[]> {
  let q = getSupabaseAdmin()
    .from("co_guide_requests")
    .select("id, landing_id, email, display_name, requested_by, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (landingId) q = q.eq("landing_id", landingId);
  const { data, error } = await q;
  if (error) {
    console.error("[co-guide-requests] list failed:", error.message);
    return [];
  }
  return (data ?? []) as CoGuideRequestRow[];
}

/** Admin decision. Approving adds the co-guide (and emails an invite to a new guide). */
export async function decideCoGuideRequest(opts: {
  requestId: string;
  action: "approve" | "reject";
  adminId: string;
  origin: string;
  req?: Request;
}): Promise<{
  ok: boolean;
  error?: string;
  warning?: string;
  invited?: boolean;
  inviteLink?: string;
}> {
  const admin = getSupabaseAdmin();
  const { data: row, error } = await admin
    .from("co_guide_requests")
    .select("id, landing_id, email, display_name, status")
    .eq("id", opts.requestId)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error.message, error.code) };
  if (!row) return { ok: false, error: "הבקשה לא נמצאה." };
  if (row.status !== "pending") return { ok: false, error: "הבקשה כבר טופלה." };

  let invited = false;
  let warning: string | undefined;
  let inviteLink: string | undefined;
  if (opts.action === "approve") {
    const granted = await grantCoGuide({
      landingId: row.landing_id,
      email: row.email,
      displayName: row.display_name,
      actorId: opts.adminId,
      origin: opts.origin,
      req: opts.req,
    });
    if (!granted.ok) return { ok: false, error: granted.error };
    invited = Boolean(granted.invited);
    warning = granted.warning;
    inviteLink = granted.inviteLink;
  }

  const { error: updateError } = await admin
    .from("co_guide_requests")
    .update({
      status: opts.action === "approve" ? "approved" : "rejected",
      decided_by: opts.adminId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", opts.requestId);
  if (updateError) return { ok: false, error: updateError.message };

  logAuditEvent({
    actorId: opts.adminId,
    action: opts.action === "approve" ? "co_guide_approve" : "co_guide_reject",
    resourceType: "landing",
    resourceId: row.landing_id,
    metadata: { requestId: row.id, invited },
    req: opts.req,
  });
  return { ok: true, invited, warning, inviteLink };
}
