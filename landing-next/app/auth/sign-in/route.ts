import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/guards";

/**
 * Legacy Google-only entry. Prefer /auth/login or /auth/oauth.
 * Keeps old links working (e.g. DashboardNav previously used /auth/sign-in).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = sanitizeRedirectPath(
    url.searchParams.get("redirect") || "/dashboard"
  );
  return NextResponse.redirect(
    new URL(
      `/auth/oauth?provider=google&intent=login&redirect=${encodeURIComponent(redirectTo)}`,
      url.origin
    )
  );
}
