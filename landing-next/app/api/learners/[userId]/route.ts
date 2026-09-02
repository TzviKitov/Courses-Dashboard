import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import {
  getProfile,
  instructorRelatedToLearner,
  listLandingInstructorIds,
} from "@/lib/auth/profiles";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { REGISTRATION_SELECT_WITH_NOTES } from "@/lib/followups/access";
import { logAuditEvent } from "@/lib/security/audit";
import {
  coerceRows,
  stripSensitiveNotes,
  viewerCanSeeSensitiveNotes,
} from "@/lib/security/sensitive-notes";

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
    .select(REGISTRATION_SELECT_WITH_NOTES)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const landingIds = [
    ...new Set(
      coerceRows<{ landing_id: string }>(regs).map((r) => r.landing_id)
    ),
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

  const managedIds = new Set<string>();
  if (!adminUser) {
    const owned = landings.filter((l) => l.owner_id === user.id).map((l) => l.id);
    for (const oid of owned) managedIds.add(oid);
    for (const lid of landingIds) {
      const co = await listLandingInstructorIds(lid);
      if (co.includes(user.id)) managedIds.add(lid);
    }
  }

  const registrations = [];
  for (const rec of coerceRows<Record<string, unknown>>(regs)) {
    const landingId = String(rec.landing_id);
    const canNotes =
      !adminUser &&
      managedIds.has(landingId) &&
      (await viewerCanSeeSensitiveNotes(user, landingId));
    registrations.push(canNotes ? rec : stripSensitiveNotes(rec));
  }

  logAuditEvent({
    actorId: user.id,
    action: "view_learner",
    resourceType: "profile",
    resourceId: userId,
    req: _req,
  });

  return NextResponse.json({
    success: true,
    learner,
    registrations,
    landings,
  });
}
