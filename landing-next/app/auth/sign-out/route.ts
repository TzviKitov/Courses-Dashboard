import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/security/audit";
import {
  createSupabaseRouteHandlerClient,
  getAuthOrigin,
  getCurrentUser,
} from "@/lib/supabase/ssr";
import { IDLE_COOKIE, idleCookieOptions } from "@/lib/auth/session-policy";

export async function POST(req: Request) {
  const origin = getAuthOrigin(req);
  const user = await getCurrentUser();
  logAuditEvent({ actorId: user?.id, action: "logout", req });
  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(IDLE_COOKIE, "", idleCookieOptions(0));

  try {
    const supabase = await createSupabaseRouteHandlerClient(response);
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error);
  }

  return response;
}

export const GET = POST;
