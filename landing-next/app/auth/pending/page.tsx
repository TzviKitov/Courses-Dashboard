import Link from "next/link";
import { redirect } from "next/navigation";
import { RequestLearnersAccessButton } from "@/components/auth/RequestLearnersAccessButton";
import {
  canCreateCourses,
  isPendingInstructor,
} from "@/lib/auth/admin";
import { getProfile } from "@/lib/auth/profiles";
import { getCurrentUser } from "@/lib/supabase/ssr";

export const metadata = {
  title: "ממתין לאישור | CourseFlow",
};

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?redirect=/auth/pending");

  if (canCreateCourses(user)) {
    redirect("/dashboard/my");
  }

  const profile = await getProfile(user.id);
  const pending = isPendingInstructor(user) || profile?.status === "pending";
  const isInstructorActive =
    profile?.role === "instructor" && profile?.status === "active";
  const showRequestAccess =
    isInstructorActive &&
    !profile.can_view_all_learners &&
    !profile.requested_all_learners_at;

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--brand-bg, #f8fafc)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 text-center"
        style={{
          background: "var(--brand-surface, #fff)",
          borderColor: "var(--brand-border, #e2e8f0)",
        }}
      >
        {pending ? (
          <>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--brand-text)" }}>
              ההרשמה ממתינה לאישור
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--brand-text-muted)" }}>
              מנהל המערכת יבדוק את הפרטים ויאשר את החשבון. אחרי האישור תוכל/י ליצור קורסים.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--brand-text)" }}>
              אין הרשאת מדריך פעילה
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--brand-text-muted)" }}>
              החשבון מחובר אך אינו מורשה ליצור קורסים. פנה/י למנהל או הירשם כמדריך.
            </p>
          </>
        )}

        {showRequestAccess && (
          <div className="mb-6 text-right">
            <p className="text-sm mb-2" style={{ color: "var(--brand-text-muted)" }}>
              לאחר אישור, ניתן לבקש גישה לנתוני נערים מכל הקורסים (רק לנערים שנרשמו לקורסים שלך).
            </p>
            <RequestLearnersAccessButton />
          </div>
        )}

        {isInstructorActive && profile.requested_all_learners_at && !profile.can_view_all_learners && (
          <p className="text-sm mb-4" style={{ color: "var(--brand-accent)" }}>
            בקשת הגישה לנתוני נערים נשלחה וממתינה לאישור מנהל.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="h-11 inline-flex items-center justify-center rounded-lg border text-sm font-medium"
            style={{ borderColor: "var(--brand-border)" }}
          >
            חזרה לגלריה
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="w-full h-11 rounded-lg text-sm"
              style={{ color: "var(--brand-text-muted)" }}
            >
              התנתק
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
