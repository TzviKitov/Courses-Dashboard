import Link from "next/link";
import { isAdmin, canCreateCourses, isPendingInstructor } from "@/lib/auth/admin";
import { isSupabaseAuthAvailable, signInRedirectUrl } from "@/lib/auth/guards";
import {
  accountKindLabelHe,
  getUserRole,
  getUserStatus,
} from "@/lib/auth/types";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { NavLink } from "./NavLink";

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

  const hideOnMobile = theme === "management" || Boolean(user);
  const staffLinkClass = hideOnMobile ? "av-nav-link hidden md:inline-flex" : "av-nav-link";

  return (
    <nav className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap ms-auto" aria-label="ראשי" suppressHydrationWarning>
      <NavLink href="/dashboard" className={staffLinkClass}>
        גלריה
      </NavLink>
      {authAvailable && user && isAdmin(user) && (
        <NavLink href="/dashboard/admin" prefix className={staffLinkClass}>
          ניהול
        </NavLink>
      )}
      {authAvailable && (theme === "management" || Boolean(user)) && (
        isRegisteredStudent ? (
          <span
            className={`${staffLinkClass} opacity-45`}
            aria-disabled="true"
            title="אזור אישי לנרשמים יתווסף בהמשך"
            style={{ color: "var(--color-text-muted)", cursor: "not-allowed" }}
          >
            הקורסים שלי
          </span>
        ) : (
          <NavLink href={myCoursesHref} prefix={myCoursesHref.startsWith("/dashboard/my")} className={staffLinkClass}>
            {pendingInstructor ? "סטטוס הרשמה" : "הקורסים שלי"}
          </NavLink>
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
              style={{ color: "var(--color-text-muted)" }}
              dir="ltr"
            >
              {user.email ?? user.phone ?? "מחובר"}
            </span>
            {kindLabel && (
              <span
                className="text-[11px] font-semibold leading-tight"
                style={{
                  color: pendingInstructor
                    ? "var(--color-on-accent)"
                    : "var(--color-text-muted)",
                  background: pendingInstructor ? "var(--color-accent)" : undefined,
                  borderRadius: pendingInstructor ? "var(--radius-sm)" : undefined,
                  paddingInline: pendingInstructor ? "6px" : undefined,
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
                background: "var(--color-accent)",
                color: "var(--color-on-accent)",
              }}
            >
              ממתין לאישור
            </Link>
          )}
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="av-btn av-btn-ghost" aria-label="התנתק">
              <span className="material-symbols-rounded md:hidden" aria-hidden style={{ fontSize: 20 }}>logout</span>
              <span className="hidden md:inline">התנתק</span>
            </button>
          </form>
        </>
      )}
      {authAvailable && !user && (
        <>
          <Link
            href={signInRedirectUrl("/dashboard")}
            className="av-btn av-btn-ghost"
          >
            {theme === "public" ? "כניסת צוות" : "התחבר"}
          </Link>
          {theme === "management" && (
            <Link
              href="/auth/register"
              className="av-btn av-btn-ghost"
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
          className={`av-btn av-btn-primary ${hideOnMobile ? "hidden md:inline-flex" : ""}`}
        >
          <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>add</span>
          צור קורס חדש
        </Link>
        )}
    </nav>
  );
}
