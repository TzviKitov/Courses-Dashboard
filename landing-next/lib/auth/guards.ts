import { redirect } from "next/navigation";
import {
  canCreateCourses,
  isAdmin,
  isPendingInstructor,
} from "@/lib/auth/admin";
import { isDisabledUser } from "@/lib/auth/session-policy";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { sanitizeRedirectPath, signInRedirectUrl } from "@/lib/auth/redirect";

export { sanitizeRedirectPath, signInRedirectUrl };

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

export type PageAuthRequirement =
  | "none"
  | "authenticated"
  | "instructor"
  | "admin";

/**
 * Whether the path requires a signed-in user when Supabase DB mode is on.
 */
export function getPageAuthRequirement(pathname: string): PageAuthRequirement {
  if (!isSupabaseDbEnabled()) return "none";

  if (pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")) {
    return "admin";
  }
  if (pathname === "/dashboard/my" || pathname.startsWith("/dashboard/my/")) {
    return "instructor";
  }
  if (pathname === "/create" || pathname.startsWith("/create/")) {
    return "instructor";
  }
  if (pathname === "/auth/pending" || pathname.startsWith("/auth/pending")) {
    return "authenticated";
  }
  if (pathname === "/auth/mfa" || pathname.startsWith("/auth/mfa")) {
    return "authenticated";
  }

  return "none";
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
  if (isDisabledUser(user)) {
    redirect("/auth/login?disabled=1");
  }
  if (requirement === "admin" && !isAdmin(user)) {
    redirect("/dashboard");
  }
  if (requirement === "instructor") {
    if (isPendingInstructor(user)) {
      redirect("/auth/pending");
    }
    if (!canCreateCourses(user)) {
      redirect("/dashboard");
    }
  }
}
