import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/guards";
import {
  createSupabaseRouteHandlerClient,
  getAuthOrigin,
} from "@/lib/supabase/ssr";

/**
 * OAuth callback: exchanges the `code` for a session, persists it via cookies
 * on the redirect response, then redirects to the originally-requested path.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirect = sanitizeRedirectPath(
    url.searchParams.get("redirect") || "/dashboard"
  );
  const origin = getAuthOrigin(req);

  if (!code) {
    return NextResponse.redirect(`${origin}${redirect}`);
  }

  let response = NextResponse.redirect(`${origin}${redirect}`);
  response.headers.set("Cache-Control", "private, no-store");

  const supabase = await createSupabaseRouteHandlerClient(response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth exchange failed:", error);
    response = NextResponse.redirect(
      `${origin}/auth/sign-in?error=${encodeURIComponent(error.message)}`
    );
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}
