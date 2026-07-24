import { createHash, randomBytes } from "crypto";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { formsRequireAuth } from "@/lib/followups/dates";
import type { FormAccessType } from "@/lib/supabase/types";

const TOKEN_TTL_DAYS = 60;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Create or rotate an access token for a landing + form type.
 * Returns the raw token (only shown once / in email).
 */
export async function issueFormToken(
  landingId: string,
  formType: FormAccessType
): Promise<string> {
  const admin = getSupabaseAdmin();
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + TOKEN_TTL_DAYS);

  await admin
    .from("form_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("landing_id", landingId)
    .eq("form_type", formType)
    .is("revoked_at", null);

  const { error } = await admin.from("form_access_tokens").insert({
    landing_id: landingId,
    form_type: formType,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(error.message);
  return raw;
}

export async function resolveFormToken(rawToken: string): Promise<{
  landingId: string;
  formType: FormAccessType;
} | null> {
  if (formsRequireAuth()) return null;

  const admin = getSupabaseAdmin();
  const tokenHash = hashToken(rawToken);
  const { data } = await admin
    .from("form_access_tokens")
    .select("landing_id, form_type, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  return {
    landingId: data.landing_id,
    formType: data.form_type as FormAccessType,
  };
}

export async function requireFormToken(
  raw: string,
  expected: FormAccessType | FormAccessType[]
): Promise<
  | { landingId: string; formType: FormAccessType }
  | { error: Response }
> {
  if (!isSupabaseDbEnabled()) {
    return {
      error: Response.json({ success: false, error: "DB disabled" }, { status: 503 }),
    };
  }
  const resolved = await resolveFormToken(raw);
  if (!resolved) {
    return {
      error: Response.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(resolved.formType)) {
    return {
      error: Response.json({ success: false, error: "Wrong form token" }, { status: 403 }),
    };
  }
  return resolved;
}
