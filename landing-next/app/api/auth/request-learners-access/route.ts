import { NextResponse } from "next/server";
import { getProfile, updateProfile } from "@/lib/auth/profiles";
import { getCurrentUser } from "@/lib/supabase/ssr";

/** Instructor requests can_view_all_learners from admin. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "instructor" || profile.status !== "active") {
    return NextResponse.json(
      { success: false, error: "רק מדריך פעיל יכול לבקש" },
      { status: 403 }
    );
  }

  if (profile.can_view_all_learners) {
    return NextResponse.json({ success: true, already: true });
  }

  await updateProfile(user.id, {
    requested_all_learners_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
