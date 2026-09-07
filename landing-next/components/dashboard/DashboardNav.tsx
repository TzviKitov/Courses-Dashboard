import Link from "next/link";
import { isAdmin, canCreateCourses, isPendingInstructor } from "@/lib/auth/admin";
import { isSupabaseAuthAvailable, signInRedirectUrl } from "@/lib/auth/guards";
import {
  accountKindLabelHe,
  getUserRole,
  getUserStatus,
} from "@/lib/auth/types";
import { getCurrentUser } from "@/lib/supabase/ssr";

export async function DashboardNav({
  theme = "management",
}: {
  theme?: "public" | "management";
}) {
  const user = await getCurrentUser();
  const authAvailable = isSupabaseAuthAvailable();
  const pendingInstructor = Boolean(user && isPendingInstructor(user));
  const role = getUserRole(user);
  const isRegisteredStudent = role === "student";
  const status = getUserStatus(user);
  const kindLabel = !user || !role
    ? null
    : isRegisteredStudent
      ? "משתמש רשום"
      : accountKindLabelHe(role, status ?? "active");

  const myCoursesHref =
    authAvailable && !user
      ? signInRedirectUrl("/dashboard/my")
      : pendingInstructor
        ? "/auth/pending"
        : "/dashboard/my";

  const staffLinkClass =
    theme === "management"
      ? "hidden md:inline-flex px-3 min-h-12 items-center text-sm font-medium rounded-md hover-wiggle"
      : "px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md hover-wiggle";

  return (
    <nav className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap" suppressHydrationWarning>
      <Link
        href="/dashboard"
        className={staffLinkClass}
        style={{ color: "var(--brand-text)" }}
      >
        גלריה
      </Link>
      {authAvailable && user && isAdmin(user) && (
        <Link
          href="/dashboard/admin"
          className={staffLinkClass}
          style={{ color: "var(--brand-text)" }}
        >
          ניהול
        </Link>
      )}
      {authAvailable && (theme === "management" || Boolean(user)) && (
        isRegisteredStudent ? (
          <span
            className={
              theme === "management"
                ? "hidden md:inline-flex px-3 min-h-12 items-center text-sm font-medium rounded-md"
                : "px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md"
            }
            aria-disabled="true"
            title="אזור אישי לנרשמים יתווסף בהמשך"
            style={{ color: "var(--brand-text-muted)", opacity: 0.45, cursor: "not-allowed" }}
          >
            הקורסים שלי
          </span>
        ) : (
          <Link
            href={myCoursesHref}
            className={staffLinkClass}
            style={{ color: "var(--brand-text)" }}
          >
            {pendingInstructor ? "סטטוס הרשמה" : "הקורסים שלי"}
          </Link>
        )
      )}
      {authAvailable && user && (
        <>
          <span
            className="hidden sm:inline-flex flex-col items-end px-2 max-w-[180px]"
            title={user.email ?? user.phone ?? undefined}
          >
            <span
              className="text-xs truncate w-full text-left"
              style={{ color: "var(--brand-text-muted)" }}
              dir="ltr"
            >
              {user.email ?? user.phone ?? "מחובר"}
            </span>
            {kindLabel && (
              <span
                className="text-[11px] font-semibold leading-tight"
                style={{
                  color: pendingInstructor
                    ? "#b45309"
                    : "var(--brand-text-muted)",
                }}
              >
                {kindLabel}
              </span>
            )}
          </span>
          {pendingInstructor && (
            <Link
              href="/auth/pending"
              className="px-3 min-h-12 inline-flex items-center text-sm font-semibold rounded-md sm:hidden"
              style={{
                background: "#fff7ed",
                color: "#b45309",
                border: "1px solid #fdba74",
              }}
            >
              ממתין לאישור
            </Link>
          )}
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="px-3 min-h-12 text-sm font-medium rounded-md border hover-nudge"
              style={{
                borderColor: "var(--brand-border)",
                color: "var(--brand-text-muted)",
              }}
            >
              התנתק
            </button>
          </form>
        </>
      )}
      {authAvailable && !user && (
        <>
          <Link
            href={signInRedirectUrl("/dashboard")}
            className="px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md border hover-nudge"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text-muted)",
            }}
          >
            {theme === "public" ? "כניסת צוות" : "התחבר"}
          </Link>
          {theme === "management" && (
            <Link
              href="/auth/register"
              className="px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md border hover-nudge"
              style={{
                borderColor: "var(--brand-border)",
                color: "var(--brand-text-muted)",
              }}
            >
              הרשמת מדריך
            </Link>
          )}
        </>
      )}
      {(theme === "management" || Boolean(user)) &&
        (!authAvailable || !user || canCreateCourses(user)) && (
        <Link
          href="/create"
          className={
            theme === "management"
              ? "hidden md:inline-flex px-4 min-h-12 items-center text-sm font-bold rounded-md hover-nudge"
              : "px-4 min-h-12 inline-flex items-center text-sm font-bold rounded-md hover-nudge"
          }
          style={{
            background: "var(--brand-accent)",
            color: "var(--brand-accent-contrast)",
          }}
        >
          צור קורס חדש
        </Link>
        )}
    </nav>
  );
}
