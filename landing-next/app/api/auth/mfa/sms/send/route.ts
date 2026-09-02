import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getProfile, updateProfile } from "@/lib/auth/profiles";
import { getUserRole } from "@/lib/auth/types";
import {
  normalizeIsraeliPhone,
  toIsraeliLocalPhone,
} from "@/lib/auth/phone";
import { generateMfaOtp, storeMfaOtp } from "@/lib/auth/mfa-otp";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { clientIpFromRequest } from "@/lib/security/request-meta";
import { sendIsraeliSms, isProductionRuntime } from "@/lib/sms/global-sms";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (getUserRole(user) !== "instructor") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: { phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    // optional
  }

  const profile = await getProfile(user.id);
  let phone = profile?.phone || null;
  if (typeof body.phone === "string" && body.phone.trim()) {
    const norm = normalizeIsraeliPhone(body.phone);
    if (!norm) {
      return NextResponse.json(
        { success: false, error: "מספר נייד ישראלי לא תקין" },
        { status: 400 }
      );
    }
    phone = norm;
    await updateProfile(user.id, { phone });
  }

  const local = phone ? toIsraeliLocalPhone(phone) : null;
  if (!phone || !local) {
    return NextResponse.json(
      { success: false, error: "נדרש מספר נייד לקבלת קוד" },
      { status: 400 }
    );
  }

  try {
    await assertRateLimit({
      bucket: "instructor-mfa-sms",
      key: `${user.id}:${clientIpFromRequest(req)}`,
      max: 8,
      windowSec: 15 * 60,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { success: false, error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." },
        { status: 429 }
      );
    }
    throw err;
  }

  const code = generateMfaOtp();
  const stored = await storeMfaOtp(user.id, code);
  if (!stored.ok) {
    return NextResponse.json(
      { success: false, error: stored.error || "שמירת הקוד נכשלה" },
      { status: 500 }
    );
  }

  const sent = await sendIsraeliSms({
    localPhone: local,
    message: `CourseFlow: קוד כניסה למדריך: ${code}`,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { success: false, error: sent.error || "שליחת SMS נכשלה" },
      { status: 502 }
    );
  }

  const payload: { success: true; masked: string; devCode?: string } = {
    success: true,
    masked: `****${local.slice(-4)}`,
  };
  if (!isProductionRuntime() && sent.devLogged) {
    payload.devCode = code;
  }
  return NextResponse.json(payload);
}
