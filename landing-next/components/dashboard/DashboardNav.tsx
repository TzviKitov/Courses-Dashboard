import Link from "next/link";
import { isAdmin, canCreateCourses, isPendingInstructor } from "@/lib/auth/admin";
import { isSupabaseAuthAvailable, signInRedirectUrl } from "@/lib/auth/guards";
import {
  accountKindLabelHe,
  getUserRole,
  getUserStatus,
} from "@/lib/auth/types";
import { getCurrentUser } from "@/lib/supabase/ssr";

export async function DashboardNav() {
  const user = await getCurrentUser();
  const authAvailable = isSupabaseAuthAvailable();
  const pendingInstructor = Boolean(user && isPendingInstructor(user));
  const role = getUserRole(user);
  const status = getUserStatus(user);
  const kindLabel =
    user && role
      ? accountKindLabelHe(role, status ?? "active")
      : null;

  const myCoursesHref =
    authAvailable && !user
      ? signInRedirectUrl("/dashboard/my")
      : pendingInstructor
        ? "/auth/pending"
        : "/dashboard/my";

  return (
    <nav className="flex items-center gap-2" suppressHydrationWarning>
      <Link
        href="/dashboard"
        className="px-3 py-2 text-sm font-medium rounded-md hover-wiggle"
        style={{ color: "var(--brand-text)" }}
      >
        גלריה
      </Link>
      {authAvailable && user && isAdmin(user) && (
        <Link
          href="/dashboard/admin"
          className="px-3 py-2 text-sm font-medium rounded-md hover-wiggle"
          style={{ color: "var(--brand-text)" }}
        >
          ניהול
        </Link>
      )}
      {authAvailable && (
        <Link
          href={myCoursesHref}
          className="px-3 py-2 text-sm font-medium rounded-md hover-wiggle"
          style={{ color: "var(--brand-text)" }}
        >
          {pendingInstructor ? "סטטוס הרשמה" : "הקורסים שלי"}
        </Link>
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
              className="px-2 py-1 text-[11px] font-semibold rounded-md sm:hidden"
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
              className="px-3 py-2 text-sm font-medium rounded-md border hover-nudge"
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
            className="px-3 py-2 text-sm font-medium rounded-md border hover-nudge"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text-muted)",
            }}
          >
            התחבר
          </Link>
          <Link
            href="/auth/register"
            className="px-3 py-2 text-sm font-medium rounded-md border hover-nudge"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text-muted)",
            }}
          >
            הרשמת מדריך
          </Link>
        </>
      )}
      {(!authAvailable || !user || canCreateCourses(user)) && (
        <Link
          href="/create"
          className="px-4 py-2 text-sm font-bold rounded-md text-white hover-nudge"
          style={{ background: "var(--brand-accent)" }}
        >
          צור קורס חדש
        </Link>
      )}
    </nav>
  );
}
