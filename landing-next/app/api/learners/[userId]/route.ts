import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import {
  getProfile,
  instructorRelatedToLearner,
} from "@/lib/auth/profiles";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { REGISTRATION_SELECT } from "@/lib/followups/access";

/**
 * GET learner profile + registrations across courses.
 * Admin: all. Instructor with can_view_all_learners: only if related via own course.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { userId } = await ctx.params;
  const adminUser = isAdmin(user);
  if (!adminUser) {
    const profile = await getProfile(user.id);
    if (!profile?.can_view_all_learners) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
    const related = await instructorRelatedToLearner(user.id, userId);
    if (!related) {
      return NextResponse.json(
        { success: false, error: "Forbidden — הנער אינו קשור לקורסים שלך" },
        { status: 403 }
      );
    }
  }

  const admin = getSupabaseAdmin();
  const learner = await getProfile(userId);
  const { data: regs } = await admin
    .from("registrations")
    .select(REGISTRATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const landingIds = [
    ...new Set((regs ?? []).map((r: { landing_id: string }) => r.landing_id)),
  ];
  let landings: { id: string; course: { title?: string } | null; owner_id: string | null }[] =
    [];
  if (landingIds.length) {
    const { data } = await admin
      .from("landings")
      .select("id, course, owner_id")
      .in("id", landingIds);
    landings = (data ?? []) as typeof landings;
  }

  return NextResponse.json({
    success: true,
    learner,
    registrations: regs ?? [],
    landings,
  });
}
