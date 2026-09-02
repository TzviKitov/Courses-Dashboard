import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/security/audit";
import {
  assertRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { clientIpFromRequest } from "@/lib/security/request-meta";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";

const TYPES = new Set(["access", "rectify", "erase", "other"]);

export async function POST(req: Request) {
  let body: {
    requestType?: string;
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    details?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const requestType = body.requestType || "";
  if (!fullName || !TYPES.has(requestType)) {
    return Response.json({ success: false, error: "חסרים שדות" }, { status: 400 });
  }
  if (!body.email && !body.phone) {
    return Response.json(
      { success: false, error: "נדרש אימייל או טלפון לזיהוי" },
      { status: 400 }
    );
  }

  try {
    await assertRateLimit({
      bucket: "data-request",
      key: clientIpFromRequest(req),
      max: 8,
      windowSec: 3600,
    });
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "השירות אינו זמין" }, { status: 503 });
  }

  const phone =
    typeof body.phone === "string"
      ? normalizeIsraeliPhone(body.phone) || body.phone.trim()
      : null;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("data_requests").insert({
    request_type: requestType,
    full_name: fullName.slice(0, 200),
    email: body.email ? String(body.email).trim().slice(0, 200) : null,
    phone,
    details: typeof body.details === "string" ? body.details.slice(0, 4000) : null,
  });

  if (error) {
    console.error("[data-requests] insert:", error.message);
    return Response.json(
      {
        success: false,
        error:
          "שמירת הבקשה נכשלה. הריצו db/schema-privacy.sql ב-Supabase ואז נסו שוב.",
      },
      { status: 500 }
    );
  }

  logAuditEvent({
    action: "data_request",
    resourceType: "data_request",
    metadata: { requestType },
    req,
  });

  return Response.json({ success: true });
}
