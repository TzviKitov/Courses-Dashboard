import { isAdmin, canCreateCourses, isPendingInstructor } from "@/lib/auth/admin";
import { isSupabaseAuthAvailable, signInRedirectUrl } from "@/lib/auth/guards";
import { getUserRole } from "@/lib/auth/types";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { ManagementBottomNav } from "./ManagementBottomNav";

export async function ManagementBottomNavHost() {
  const user = await getCurrentUser();
  const authAvailable = isSupabaseAuthAvailable();
  const pendingInstructor = Boolean(user && isPendingInstructor(user));
  const isRegisteredStudent = getUserRole(user) === "student";

  const myCoursesHref =
    authAvailable && !user
      ? signInRedirectUrl("/dashboard/my")
      : pendingInstructor
        ? "/auth/pending"
        : "/dashboard/my";

  return (
    <ManagementBottomNav
      showAdmin={Boolean(authAvailable && user && isAdmin(user))}
      myCoursesHref={myCoursesHref}
      showCreate={!authAvailable || !user || canCreateCourses(user)}
      disableMyCourses={isRegisteredStudent}
    />
  );
}
