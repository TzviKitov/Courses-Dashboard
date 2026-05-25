import Link from "next/link";
import { isAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { isSupabaseAuthAvailable } from "@/lib/auth/guards";

export async function DashboardNav() {
  const user = await getCurrentUser();
  const authAvailable = isSupabaseAuthAvailable();

  return (
    <nav className="flex items-center gap-2">
      <Link
        href="/dashboard"
        className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
        style={{ color: "var(--brand-text)" }}
      >
        גלריה
      </Link>
      {authAvailable && user && isAdmin(user) && (
        <Link
          href="/dashboard/admin"
          className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ color: "var(--brand-text)" }}
        >
          ניהול
        </Link>
      )}
      {authAvailable && (
        <Link
          href="/dashboard/my"
          className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ color: "var(--brand-text)" }}
        >
          הקורסים שלי
        </Link>
      )}
      {authAvailable && !user && (
        <Link
          href="/auth/sign-in?redirect=/dashboard"
          className="px-3 py-2 text-sm font-medium rounded-md border transition-colors"
          style={{
            borderColor: "var(--brand-border)",
            color: "var(--brand-text-muted)",
          }}
        >
          התחבר
        </Link>
      )}
      <Link
        href="/create"
        className="px-4 py-2 text-sm font-bold rounded-md text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--brand-accent)" }}
      >
        צור קורס חדש
      </Link>
    </nav>
  );
}
