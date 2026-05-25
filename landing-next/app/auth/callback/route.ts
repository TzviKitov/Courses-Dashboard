import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/ssr";

/**
 * OAuth callback: exchanges the `code` for a session, persists it via cookies,
 * then redirects to the originally-requested path.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirect = sanitizeRedirectPath(
    url.searchParams.get("redirect") || "/dashboard"
  );
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${redirect}`);
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth exchange failed:", error);
    return NextResponse.redirect(
      `${baseUrl}/auth/sign-in?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${baseUrl}${redirect}`);
}
