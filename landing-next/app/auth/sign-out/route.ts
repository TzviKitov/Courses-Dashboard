import { NextResponse } from "next/server";
import {
  createSupabaseRouteHandlerClient,
  getAuthOrigin,
} from "@/lib/supabase/ssr";

export async function POST(req: Request) {
  const origin = getAuthOrigin(req);
  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.headers.set("Cache-Control", "private, no-store");

  try {
    const supabase = await createSupabaseRouteHandlerClient(response);
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error);
  }

  return response;
}

export const GET = POST;
