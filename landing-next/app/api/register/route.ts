import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { ensureProfile } from "@/lib/auth/profiles";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";
import { logAuditEvent } from "@/lib/security/audit";
import {
  assertRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { clientIpFromRequest } from "@/lib/security/request-meta";

interface RegisterPayload {
  landingId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  referral?: string;
  notes?: string;
  birthYear?: number;
  parentName?: string;
  parentPhone?: string;
  parentConsent?: boolean;
  marketingOptIn?: boolean;
}

function currentAgeFromBirthYear(year: number): number {
  const now = new Date();
  return now.getUTCFullYear() - year;
}

/**
 * POST /api/register
 *
 * Requires authenticated student (or elevated) session.
 * Writes registration linked to user_id.
 */
export async function POST(req: Request) {
  let body: RegisterPayload;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!body.landingId || !body.fullName || !body.phone) {
    return Response.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const birthYear =
    typeof body.birthYear === "number"
      ? body.birthYear
      : typeof body.birthYear === "string"
        ? Number(body.birthYear)
        : NaN;
  const yearNow = new Date().getUTCFullYear();
  if (!Number.isInteger(birthYear) || birthYear < yearNow - 80 || birthYear > yearNow - 10) {
    return Response.json(
      { success: false, error: "יש למלא שנת לידה תקינה" },
      { status: 400 }
    );
  }

  const age = currentAgeFromBirthYear(birthYear);
  const isMinor = age < 18;
  if (isMinor) {
    const parentName =
      typeof body.parentName === "string" ? body.parentName.trim() : "";
    const parentPhone = normalizeIsraeliPhone(body.parentPhone || "") || "";
    if (!parentName || !parentPhone || !body.parentConsent) {
      return Response.json(
        {
          success: false,
          error:
            "לקטינים נדרשים שם הורה, טלפון הורה, והסכמה מפורשת לתיעוד התנהגות בקורס",
        },
        { status: 400 }
      );
    }
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      {
        success: false,
        error: "יש להתחבר או להירשם לפני שליחת ההרשמה",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  try {
    await assertRateLimit({
      bucket: "register",
      key: `${user.id}:${clientIpFromRequest(req)}`,
      max: 8,
      windowSec: 15 * 60,
    });
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  const phoneNorm = normalizeIsraeliPhone(body.phone) || body.phone.trim();
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : user.email || null;

  await ensureProfile({
    userId: user.id,
    displayName:
      body.fullName.trim() ||
      (user.user_metadata?.full_name as string | undefined) ||
      null,
    role: "student",
    status: "active",
    createdVia: user.phone
      ? "phone"
      : user.app_metadata?.provider === "azure"
        ? "azure"
        : user.app_metadata?.provider === "google"
          ? "google"
          : "email",
    phone: phoneNorm,
    preserveElevatedRole: true,
  });

  let storedInDb = false;

  if (isSupabaseDbEnabled()) {
    try {
      const admin = getSupabaseAdmin();
      const parentPhoneNorm = isMinor
        ? normalizeIsraeliPhone(body.parentPhone || "")
        : null;
      const { error } = await admin.from("registrations").insert({
        landing_id: body.landingId,
        full_name: body.fullName.trim(),
        phone: phoneNorm,
        email,
        referral: body.referral || null,
        notes: body.notes || null,
        user_id: user.id,
        birth_year: birthYear,
        parent_name: isMinor ? String(body.parentName).trim() : null,
        parent_phone: parentPhoneNorm,
        parent_consent_at: isMinor ? new Date().toISOString() : null,
        marketing_opt_in: Boolean(body.marketingOptIn),
      });
      if (error) {
        console.error("Supabase registration insert failed:", error);
      } else {
        storedInDb = true;
      }
    } catch (error) {
      console.error("Registration error:", error);
    }
  }

  if (!storedInDb && isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Failed to store registration" },
      { status: 500 }
    );
  }

  logAuditEvent({
    actorId: user.id,
    action: "register",
    resourceType: "landing",
    resourceId: body.landingId,
    req,
  });

  return Response.json({ success: true });
}
