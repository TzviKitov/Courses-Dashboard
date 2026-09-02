import type { ProfileRole } from "@/lib/auth/types";

export const MFA_TRUST_COOKIE = "lg_mfa_trust";
/** Remember second-factor on this browser for 20 days. */
export const MFA_TRUST_MAX_AGE_SEC = 20 * 24 * 60 * 60;
export const MFA_TRUST_MS = MFA_TRUST_MAX_AGE_SEC * 1000;

export const MFA_ENROLL_PATH = "/auth/mfa";
export const MFA_SMS_PATH = "/auth/mfa-sms";

export type MfaTrustMethod = "totp" | "sms";

export interface MfaTrustPayload {
  u: string;
  r: "admin" | "instructor";
  m: MfaTrustMethod;
  e: number;
}

function getSecret(explicit?: string): string {
  return (
    explicit ||
    process.env.MFA_TRUST_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "courseflow-mfa-trust-dev"
  );
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return bytesToB64url(new Uint8Array(sig));
}

export async function signMfaTrust(
  payload: MfaTrustPayload,
  secret?: string
): Promise<string> {
  const body = bytesToB64url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const sig = await hmac(getSecret(secret), body);
  return `${body}.${sig}`;
}

export async function parseMfaTrustCookie(
  raw: string | undefined | null,
  opts: { userId: string; role: ProfileRole },
  secret?: string
): Promise<MfaTrustPayload | null> {
  if (!raw || !raw.includes(".")) return null;
  const dot = raw.indexOf(".");
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = await hmac(getSecret(secret), body);
  if (expected.length !== sig.length) return null;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (ok !== 0) return null;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(body));
    const payload = JSON.parse(json) as MfaTrustPayload;
    if (payload.u !== opts.userId) return null;
    if (payload.r !== opts.role) return null;
    if (opts.role === "admin" && payload.m !== "totp") return null;
    if (opts.role === "instructor" && payload.m !== "sms") return null;
    if (typeof payload.e !== "number" || payload.e < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function mfaPathForRole(role: ProfileRole | null): string {
  if (role === "admin") return MFA_ENROLL_PATH;
  return MFA_SMS_PATH;
}

export function mfaTrustCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MFA_TRUST_MAX_AGE_SEC,
  };
}

export async function buildMfaTrustValue(opts: {
  userId: string;
  role: "admin" | "instructor";
  method: MfaTrustMethod;
}): Promise<string> {
  return signMfaTrust({
    u: opts.userId,
    r: opts.role,
    m: opts.method,
    e: Date.now() + MFA_TRUST_MS,
  });
}
