import { sendPasswordResetEmail } from "@/lib/email/auth-emails";
import { clientIpFromRequest } from "@/lib/security/request-meta";
import {
  assertRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { getAuthOrigin } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

/** Public password reset — always returns success to avoid email enumeration. */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ success: false, error: "נדרש אימייל תקין" }, { status: 400 });
  }
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "שירות לא זמין" }, { status: 503 });
  }

  const ip = clientIpFromRequest(req);
  try {
    await assertRateLimit({
      bucket: "forgot-password",
      key: `${email}:${ip}`,
      max: 5,
      windowSec: 15 * 60,
    });
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
  }

  const admin = getSupabaseAdmin();
  const origin = getAuthOrigin(req);
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/set-password` },
  });

  if (!linkErr && linkData) {
    const actionLink =
      linkData.properties?.action_link ||
      (linkData as { action_link?: string }).action_link;
    if (actionLink) {
      await sendPasswordResetEmail({ to: email, setPasswordUrl: actionLink });
    }
  }

  return Response.json({ success: true });
}
