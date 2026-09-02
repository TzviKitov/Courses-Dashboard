import type { User } from "@supabase/supabase-js";
import { getUserStatus } from "@/lib/auth/types";

export function isDisabledUser(user: User | null | undefined): boolean {
  return getUserStatus(user) === "disabled";
}

export const INSTRUCTOR_IDLE_MS = 30 * 60 * 1000;
export const IDLE_COOKIE = "lg_last_activity";
export {
  MFA_ENROLL_PATH,
  MFA_SMS_PATH,
  MFA_TRUST_COOKIE,
} from "@/lib/auth/mfa-trust";

export function idleCookieOptions(maxAgeSec: number): {
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
    maxAge: maxAgeSec,
  };
}
