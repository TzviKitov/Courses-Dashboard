import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/guards";
import { getAuthOrigin, getSupabaseServer } from "@/lib/supabase/ssr";

/**
 * Initiates the Google OAuth flow. Redirects to Supabase, which then redirects
 * to /auth/callback once authenticated.
 *
 * Query params:
 *   redirect - relative path to return to after sign-in (default: /dashboard).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = sanitizeRedirectPath(
    url.searchParams.get("redirect") || "/dashboard"
  );
  const origin = getAuthOrigin(req);

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error || !data?.url) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to start OAuth" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.url);
}
