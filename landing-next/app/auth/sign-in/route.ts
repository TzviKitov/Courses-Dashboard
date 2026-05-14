import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/ssr";

/**
 * Initiates the Google OAuth flow. Redirects to Supabase, which then redirects
 * to /auth/callback once authenticated.
 *
 * Query params:
 *   redirect - relative path to return to after sign-in (default: /dashboard/my).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("redirect") || "/dashboard/my";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
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
