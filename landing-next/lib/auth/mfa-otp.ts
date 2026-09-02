import { createHash, randomInt } from "crypto";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function pepper(): string {
  return (
    process.env.MFA_TRUST_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "courseflow-mfa-otp-dev"
  );
}

export function hashMfaOtp(userId: string, code: string): string {
  return createHash("sha256")
    .update(`${userId}:${code}:${pepper()}`)
    .digest("hex");
}

export function generateMfaOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function storeMfaOtp(
  userId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseDbEnabled()) {
    return { ok: false, error: "DB disabled" };
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("mfa_otp_challenges").upsert(
    {
      user_id: userId,
      code_hash: hashMfaOtp(userId, code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[mfa-otp] store:", error.message);
    return {
      ok: false,
      error: "שמירת הקוד נכשלה. הריצו schema-privacy.sql ב-Supabase.",
    };
  }
  return { ok: true };
}

export async function verifyMfaOtp(
  userId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseDbEnabled()) {
    return { ok: false, error: "DB disabled" };
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("mfa_otp_challenges")
    .select("code_hash, expires_at, attempts")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "אין קוד פעיל. בקשו קוד חדש." };
  }
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    await admin.from("mfa_otp_challenges").delete().eq("user_id", userId);
    return { ok: false, error: "פג תוקף הקוד. בקשו קוד חדש." };
  }
  const attempts = Number(data.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    await admin.from("mfa_otp_challenges").delete().eq("user_id", userId);
    return { ok: false, error: "יותר מדי ניסיונות. בקשו קוד חדש." };
  }
  if (data.code_hash !== hashMfaOtp(userId, code.trim())) {
    await admin
      .from("mfa_otp_challenges")
      .update({ attempts: attempts + 1 })
      .eq("user_id", userId);
    return { ok: false, error: "קוד שגוי" };
  }
  await admin.from("mfa_otp_challenges").delete().eq("user_id", userId);
  return { ok: true };
}
