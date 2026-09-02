import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getUserRole } from "@/lib/auth/types";
import { verifyMfaOtp } from "@/lib/auth/mfa-otp";
import {
  MFA_TRUST_COOKIE,
  buildMfaTrustValue,
  mfaTrustCookieOptions,
} from "@/lib/auth/mfa-trust";
import { logAuditEvent } from "@/lib/security/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (getUserRole(user) !== "instructor") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, error: "קוד בן 6 ספרות" }, { status: 400 });
  }

  const result = await verifyMfaOtp(user.id, code);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error || "קוד שגוי" },
      { status: 400 }
    );
  }

  const value = await buildMfaTrustValue({
    userId: user.id,
    role: "instructor",
    method: "sms",
  });
  const res = NextResponse.json({ success: true });
  res.cookies.set(MFA_TRUST_COOKIE, value, mfaTrustCookieOptions());
  logAuditEvent({
    actorId: user.id,
    action: "login_success",
    metadata: { mfa: "sms", trust: "20d" },
    req,
  });
  return res;
}
