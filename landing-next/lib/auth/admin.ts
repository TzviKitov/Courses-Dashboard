import type { User } from "@supabase/supabase-js";

/** Admin role is set in Supabase Auth app_metadata: { "role": "admin" }. */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = user.app_metadata?.role;
  return role === "admin";
}

/** Owner or platform admin may manage a landing. */
export function canManageLanding(
  user: User | null | undefined,
  ownerId: string | null | undefined
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!ownerId) return false;
  return ownerId === user.id;
}
