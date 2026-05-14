import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/ssr";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin;

  try {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error);
  }

  return NextResponse.redirect(`${baseUrl}/dashboard`);
}

export const GET = POST;
