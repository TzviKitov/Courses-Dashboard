import type { User } from "@supabase/supabase-js";
import {
  getUserRole,
  getUserStatus,
  type ProfileRole,
  type ProfileStatus,
} from "@/lib/auth/types";
import { getProfile, listLandingInstructorIds } from "@/lib/auth/profiles";

/** Admin role is set in Supabase Auth app_metadata: { "role": "admin" }. */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return getUserRole(user) === "admin";
}

export function isActiveInstructorOrAdmin(
  user: User | null | undefined
): boolean {
  if (!user) return false;
  const role = getUserRole(user);
  const status = getUserStatus(user);
  if (status === "disabled") return false;
  if (role === "admin") return true;
  return role === "instructor" && status === "active";
}

export function canCreateCourses(user: User | null | undefined): boolean {
  return isActiveInstructorOrAdmin(user);
}

export function isPendingInstructor(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    getUserRole(user) === "instructor" && getUserStatus(user) === "pending"
  );
}

/**
 * Owner, co-instructor (ids), or platform admin may manage a landing.
 * Prefer async `userCanManageLanding` when instructor list is not preloaded.
 */
export function canManageLanding(
  user: User | null | undefined,
  ownerId: string | null | undefined,
  coInstructorIds?: string[] | null
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!ownerId && !coInstructorIds?.length) return false;
  if (ownerId && ownerId === user.id) return true;
  if (coInstructorIds?.includes(user.id)) return true;
  return false;
}

export async function userCanManageLanding(
  user: User | null | undefined,
  landingId: string,
  ownerId: string | null | undefined
): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (ownerId && ownerId === user.id) return true;
  const co = await listLandingInstructorIds(landingId);
  return co.includes(user.id);
}

export async function userCanViewAllLearnersFlag(
  user: User | null | undefined
): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const profile = await getProfile(user.id);
  return Boolean(profile?.can_view_all_learners);
}

export function roleLabel(role: ProfileRole): string {
  switch (role) {
    case "admin":
      return "מנהל";
    case "instructor":
      return "מדריך";
    case "student":
      return "נער/ת";
    default:
      return role;
  }
}

export function statusLabel(status: ProfileStatus): string {
  switch (status) {
    case "pending":
      return "ממתין לאישור";
    case "active":
      return "פעיל";
    case "disabled":
      return "מושבת";
    default:
      return status;
  }
}
