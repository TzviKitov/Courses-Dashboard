import { NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServer } from "@/lib/supabase/ssr";
import { getUserRole } from "@/lib/auth/types";
import {
  MFA_TRUST_COOKIE,
  buildMfaTrustValue,
  mfaTrustCookieOptions,
} from "@/lib/auth/mfa-trust";
import { logAuditEvent } from "@/lib/security/audit";

/**
 * After admin TOTP verify (AAL2), stamp 20-day trusted-device cookie.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (getUserRole(user) !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = await getSupabaseServer();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return NextResponse.json(
        { success: false, error: "יש להשלים אימות באפליקציה תחילה" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "לא ניתן לאמת MFA" },
      { status: 503 }
    );
  }

  const value = await buildMfaTrustValue({
    userId: user.id,
    role: "admin",
    method: "totp",
  });
  const res = NextResponse.json({ success: true });
  res.cookies.set(MFA_TRUST_COOKIE, value, mfaTrustCookieOptions());
  logAuditEvent({
    actorId: user.id,
    action: "login_success",
    metadata: { mfa: "totp", trust: "20d" },
    req,
  });
  return res;
}
