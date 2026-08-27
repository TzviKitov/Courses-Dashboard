import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { ensureProfile } from "@/lib/auth/profiles";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";

interface RegisterPayload {
  landingId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  referral?: string;
  notes?: string;
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
    createdVia: user.phone ? "phone" : user.app_metadata?.provider === "azure" ? "azure" : user.app_metadata?.provider === "google" ? "google" : "email",
    phone: phoneNorm,
    preserveElevatedRole: true,
  });

  let storedInDb = false;

  if (isSupabaseDbEnabled()) {
    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("registrations").insert({
        landing_id: body.landingId,
        full_name: body.fullName,
        phone: phoneNorm,
        email,
        referral: body.referral || null,
        notes: body.notes || null,
        user_id: user.id,
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

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (appsScriptUrl) {
    try {
      await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          ...body,
          email: email ?? "",
          userId: user.id,
        }),
      });
    } catch (error) {
      console.warn("Apps Script mirror failed (ignoring):", error);
    }
  }

  if (!storedInDb && isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Failed to store registration" },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
