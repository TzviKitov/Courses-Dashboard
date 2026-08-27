import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/guards";
import { getAuthOrigin, getSupabaseServer } from "@/lib/supabase/ssr";

type Provider = "google" | "azure";
type Intent = "login" | "instructor" | "student" | "link";

/**
 * Starts OAuth (Google or Microsoft/Azure).
 * Query: provider, intent, redirect, landingId (optional for student)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") || "google") as Provider;
  const intent = (url.searchParams.get("intent") || "login") as Intent;
  const redirectTo = sanitizeRedirectPath(
    url.searchParams.get("redirect") || "/dashboard"
  );
  const landingId = url.searchParams.get("landingId") || "";
  const origin = getAuthOrigin(req);

  if (provider !== "google" && provider !== "azure") {
    return NextResponse.json(
      { success: false, error: "Unsupported provider" },
      { status: 400 }
    );
  }

  const callbackParams = new URLSearchParams({
    redirect: redirectTo,
    intent,
  });
  if (landingId) callbackParams.set("landingId", landingId);

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?${callbackParams.toString()}`,
      scopes: provider === "azure" ? "openid email profile offline_access" : undefined,
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
