import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import {
  normalizeIsraeliPhone,
  toIsraeliLocalPhone,
} from "@/lib/auth/phone";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  isProductionRuntime,
  sendIsraeliSms,
} from "@/lib/sms/global-sms";

/** Supabase stores secrets as `v1,whsec_...` — Standard Webhooks needs the base64 part. */
function hookSecretKey(raw: string): string {
  return raw
    .trim()
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
}

/**
 * Supabase Auth Hook: Send SMS via Global SMS SOAP (sapi).
 *
 * Auth uses Standard Webhooks (not Bearer). In Supabase Hook settings use
 * "Generate secret", then set the same value (including `v1,whsec_` prefix)
 * as SMS_HOOK_SECRET in Vercel / .env.local.
 */
export async function POST(req: Request) {
  const secret = process.env.SMS_HOOK_SECRET?.trim();
  const rawBody = await req.text();

  let payload: {
    user?: { phone?: string };
    sms?: { otp?: string };
  };

  if (secret) {
    try {
      const wh = new Webhook(hookSecretKey(secret));
      const headers = Object.fromEntries(req.headers.entries());
      payload = wh.verify(rawBody, headers) as typeof payload;
    } catch (e) {
      console.error("[sms-hook] webhook verify failed:", e);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (isProductionRuntime()) {
    console.error("[sms-hook] SMS_HOOK_SECRET missing in production");
    return NextResponse.json(
      { error: "SMS hook not configured" },
      { status: 500 }
    );
  } else {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const phoneRaw = payload.user?.phone || "";
  const otp = payload.sms?.otp || "";
  const phoneE164 = normalizeIsraeliPhone(phoneRaw);
  const phoneLocal = phoneE164 ? toIsraeliLocalPhone(phoneE164) : null;

  if (!otp || !phoneLocal) {
    return NextResponse.json(
      { error: "Missing phone/otp or invalid Israeli mobile" },
      { status: 400 }
    );
  }

  if (process.env.SMS_ISRAEL_ONLY !== "false" && !phoneE164) {
    console.warn("[sms-hook] Rejected non-IL phone");
    return NextResponse.json({ error: "Israel numbers only" }, { status: 400 });
  }

  try {
    await assertRateLimit({
      bucket: "sms-otp",
      key: phoneE164 || phoneLocal,
      max: 8,
      windowSec: 15 * 60,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many OTP requests" }, { status: 429 });
    }
    throw err;
  }

  const message = `CourseFlow: קוד אימות להרשמה או התחברות: ${otp}`;
  const sent = await sendIsraeliSms({ localPhone: phoneLocal, message });
  if (!sent.ok) {
    const status = sent.error?.includes("not configured") ? 500 : 502;
    return NextResponse.json({ error: sent.error || "SMS send failed" }, { status });
  }
  if (sent.devLogged) {
    console.info(`[sms-hook] DEV OTP for ${phoneLocal}: ${otp}`);
  }

  return NextResponse.json({});
}
