import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard";
import { assertPageAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { userCanManageLanding } from "@/lib/auth/admin";
import { isNonGalleryAudience } from "@/lib/landings/visibility";
import { EditCourseForm, type EditCourseValues } from "./EditCourseForm";

export const dynamic = "force-dynamic";

type Course = Record<string, unknown> & { schedule?: Record<string, unknown> };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="עריכת קורס">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  await assertPageAccess(
    (await headers()).get("x-pathname") ?? `/dashboard/my/${id}/edit`
  );
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: landing } = await getSupabaseAdmin()
    .from("landings")
    .select("id, owner_id, course, form, is_public, price, start_date, end_date")
    .eq("id", id)
    .maybeSingle();

  if (!landing || !(await userCanManageLanding(user, id, landing.owner_id))) {
    notFound();
  }

  const course = (landing.course ?? {}) as Course;
  const schedule = course.schedule ?? {};
  const form = (landing.form ?? {}) as Record<string, unknown>;

  const initial: EditCourseValues = {
    title: str(course.title),
    description: str(course.description),
    extendedDescription: str(course.extendedDescription),
    faqText: str(course.faqText),
    syllabusText: str(course.syllabusText),
    location: str(course.location),
    duration: str(course.duration),
    ageRange: str(course.ageRange),
    instructorName: str(course.instructorName),
    organization: str(course.organization),
    role: str(course.role),
    contactPhone: str(course.contactPhone),
    contactEmail: str(course.contactEmail),
    startDate: landing.start_date ?? str(schedule.startDate),
    endDate: landing.end_date ?? str(schedule.endDate),
    interviewDate: str(schedule.interviewDate),
    time: str(schedule.time),
    days: str(schedule.days),
    price: landing.price === null ? "" : String(Number(landing.price)),
    paymentLink: str(form.paymentLink),
    requiresInterview: Boolean(form.requiresInterview),
    hidden: !landing.is_public,
  };

  return (
    <DashboardShell
      title={`עריכת קורס: ${initial.title || "ללא כותרת"}`}
      actions={
        <Link
          href={`/dashboard/my/${id}`}
          className="px-3 py-2 text-xs font-medium rounded-md border hover-nudge"
          style={{
            borderColor: "var(--brand-border)",
            color: "var(--brand-text-muted)",
          }}
        >
          חזרה לניהול
        </Link>
      }
    >
      <EditCourseForm
        landingId={id}
        initial={initial}
        hiddenLocked={isNonGalleryAudience(course.audienceCategory)}
      />
    </DashboardShell>
  );
}
