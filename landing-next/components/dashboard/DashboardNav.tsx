import Link from "next/link";
import { isAdmin, canCreateCourses } from "@/lib/auth/admin";
import { isSupabaseAuthAvailable, signInRedirectUrl } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/supabase/ssr";

export async function DashboardNav() {
  const user = await getCurrentUser();
  const authAvailable = isSupabaseAuthAvailable();

  const myCoursesHref =
    authAvailable && !user
      ? signInRedirectUrl("/dashboard/my")
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
          הקורסים שלי
        </Link>
      )}
      {authAvailable && user && (
        <>
          <span
            className="hidden sm:inline px-2 text-xs truncate max-w-[140px]"
            style={{ color: "var(--brand-text-muted)" }}
            title={user.email ?? user.phone ?? undefined}
          >
            {user.email ?? user.phone ?? "מחובר"}
          </span>
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
