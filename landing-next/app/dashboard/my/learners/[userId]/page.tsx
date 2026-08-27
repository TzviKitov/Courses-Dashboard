import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard";
import { assertPageAccess } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/admin";
import {
  getProfile,
  instructorRelatedToLearner,
} from "@/lib/auth/profiles";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT } from "@/lib/followups/access";
import type { RegistrationRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function LearnerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!isSupabaseDbEnabled()) notFound();

  const pathname =
    (await headers()).get("x-pathname") ?? `/dashboard/my/learners/${userId}`;
  await assertPageAccess(pathname);

  const user = await getCurrentUser();
  if (!user) return null;

  const viewerProfile = await getProfile(user.id);
  const adminUser = isAdmin(user);
  const related = adminUser
    ? true
    : await instructorRelatedToLearner(user.id, userId);

  if (!adminUser && !related) notFound();

  const canSeeAllCourses =
    adminUser || Boolean(viewerProfile?.can_view_all_learners);

  const learner = await getProfile(userId);
  if (!learner) notFound();

  const admin = getSupabaseAdmin();
  const { data: regs } = await admin
    .from("registrations")
    .select(REGISTRATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  let items = (regs ?? []) as RegistrationRow[];

  if (!canSeeAllCourses) {
    const { data: owned } = await admin
      .from("landings")
      .select("id")
      .eq("owner_id", user.id);
    const { data: co } = await admin
      .from("landing_instructors")
      .select("landing_id")
      .eq("user_id", user.id);
    const allowed = new Set<string>([
      ...(owned ?? []).map((r: { id: string }) => r.id),
      ...(co ?? []).map((r: { landing_id: string }) => r.landing_id),
    ]);
    items = items.filter((r) => allowed.has(r.landing_id));
  }

  const landingIds = [...new Set(items.map((r) => r.landing_id))];
  const titleById = new Map<string, string>();
  if (landingIds.length) {
    const { data: landings } = await admin
      .from("landings")
      .select("id, course")
      .in("id", landingIds);
    for (const l of landings ?? []) {
      titleById.set(
        l.id as string,
        ((l.course as { title?: string })?.title || l.id) as string
      );
    }
  }

  return (
    <DashboardShell
      title={learner.display_name || "פרופיל נער/ה"}
      subtitle={
        canSeeAllCourses
          ? "הרשמות מכל הקורסים"
          : "הרשמות לקורסים שלך בלבד (בקש הרשאה חוצת־קורסים להרחבה)"
      }
    >
      <dl className="mb-6 text-sm grid gap-2">
        <div>
          <dt className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
            טלפון
          </dt>
          <dd dir="ltr">{learner.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
            תפקיד
          </dt>
          <dd>
            {learner.role} / {learner.status}
          </dd>
        </div>
      </dl>

      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ borderColor: "var(--brand-border)" }}
      >
        <table className="w-full text-sm" style={{ background: "var(--brand-surface)" }}>
          <thead style={{ background: "var(--brand-accent-soft)" }}>
            <tr>
              <th className="p-3 text-right text-xs">קורס</th>
              <th className="p-3 text-right text-xs">שם בטופס</th>
              <th className="p-3 text-right text-xs">טלפון</th>
              <th className="p-3 text-right text-xs">תאריך</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                className="border-t"
                style={{ borderColor: "var(--brand-border)" }}
              >
                <td className="p-3">
                  <a
                    href={`/dashboard/my/${r.landing_id}/registrants`}
                    className="underline"
                  >
                    {titleById.get(r.landing_id) || r.landing_id}
                  </a>
                </td>
                <td className="p-3">{r.full_name}</td>
                <td className="p-3" dir="ltr">
                  {r.phone}
                </td>
                <td className="p-3 text-xs">
                  {new Date(r.created_at).toLocaleDateString("he-IL")}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-4" colSpan={4}>
                  אין הרשמות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
