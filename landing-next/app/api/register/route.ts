import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

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
 * - Writes the registration to Supabase `registrations` table when configured.
 * - Optionally mirrors to Apps Script (legacy Google Sheet) if APPS_SCRIPT_URL is set,
 *   so existing reports continue to work during the transition.
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

  if (!body.landingId || !body.fullName || !body.phone || !body.email) {
    return Response.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  let storedInDb = false;

  if (isSupabaseDbEnabled()) {
    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("registrations").insert({
        landing_id: body.landingId,
        full_name: body.fullName,
        phone: body.phone,
        email: body.email,
        referral: body.referral || null,
        notes: body.notes || null,
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

  // Optional: mirror to Apps Script so existing Google Sheet integrations
  // keep flowing. Failure here does not block the user.
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (appsScriptUrl) {
    try {
      await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          ...body,
        }),
      });
    } catch (error) {
      console.warn("Apps Script mirror failed (ignoring):", error);
    }
  }

  if (!storedInDb && !appsScriptUrl) {
    return Response.json(
      {
        success: false,
        error: "No storage backend configured (Supabase disabled and APPS_SCRIPT_URL missing).",
      },
      { status: 503 }
    );
  }

  return Response.json({ success: true });
}
