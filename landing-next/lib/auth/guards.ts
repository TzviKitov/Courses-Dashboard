import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";

/** Supabase Auth is configured (URL + anon key). */
export function isSupabaseAuthAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** DB + owner flows are active (matches lib/supabase/server). */
export function isSupabaseDbEnabled(): boolean {
  return (
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    ) && process.env.USE_SUPABASE_DB === "true"
  );
}

export type PageAuthRequirement = "none" | "authenticated" | "admin";

/**
 * Whether the path requires a signed-in user when Supabase DB mode is on.
 */
export function getPageAuthRequirement(pathname: string): PageAuthRequirement {
  if (!isSupabaseDbEnabled()) return "none";

  if (pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")) {
    return "admin";
  }
  if (pathname === "/dashboard/my" || pathname.startsWith("/dashboard/my/")) {
    return "authenticated";
  }
  if (pathname === "/create" || pathname.startsWith("/create/")) {
    return "authenticated";
  }

  return "none";
}

/** Safe relative redirect target for post sign-in (no open redirects). */
export function sanitizeRedirectPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (path.startsWith("/auth/")) return "/dashboard";
  return path;
}

export function signInRedirectUrl(returnPath: string): string {
  const safe = sanitizeRedirectPath(returnPath);
  return `/auth/sign-in?redirect=${encodeURIComponent(safe)}`;
}

/**
 * Server Component guard – redirects to sign-in when the page requires auth.
 */
export async function assertPageAccess(pathname: string): Promise<void> {
  const requirement = getPageAuthRequirement(pathname);
  if (requirement === "none") return;

  const user = await getCurrentUser();
  if (!user) {
    redirect(signInRedirectUrl(pathname));
  }
  if (requirement === "admin" && !isAdmin(user)) {
    redirect("/dashboard");
  }
}
