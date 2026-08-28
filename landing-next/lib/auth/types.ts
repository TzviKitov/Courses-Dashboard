import type { User } from "@supabase/supabase-js";

export type ProfileRole = "student" | "instructor" | "admin";
export type ProfileStatus = "pending" | "active" | "disabled";
export type ProfileCreatedVia =
  | "email"
  | "phone"
  | "google"
  | "azure"
  | "admin_invite";

/** Row stored in the `profiles` table. */
export interface ProfileRow {
  id: string;
  display_name: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  can_view_all_learners: boolean;
  phone: string | null;
  created_via: ProfileCreatedVia | null;
  requested_all_learners_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstructorEmailAllowlistRow {
  email: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LandingInstructorRow {
  landing_id: string;
  user_id: string;
  created_at: string;
  created_by: string | null;
}

/** Read role from JWT app_metadata (synced from profiles). */
export function getUserRole(user: User | null | undefined): ProfileRole | null {
  if (!user) return null;
  const role = user.app_metadata?.role;
  if (role === "admin" || role === "instructor" || role === "student") {
    return role;
  }
  return null;
}

export function getUserStatus(
  user: User | null | undefined
): ProfileStatus | null {
  if (!user) return null;
  const status = user.app_metadata?.status;
  if (status === "pending" || status === "active" || status === "disabled") {
    return status;
  }
  // Legacy admin users without status claim are treated as active.
  if (user.app_metadata?.role === "admin") return "active";
  return null;
}

const ROLE_HE: Record<ProfileRole, string> = {
  student: "נער/ה",
  instructor: "מדריך/ה",
  admin: "מנהל/ת",
};

const STATUS_HE: Record<ProfileStatus, string> = {
  pending: "ממתין לאישור",
  active: "פעיל",
  disabled: "מושבת",
};

export function roleLabelHe(role: ProfileRole | string | null | undefined): string {
  if (role === "student" || role === "instructor" || role === "admin") {
    return ROLE_HE[role];
  }
  return role || "—";
}

export function statusLabelHe(
  status: ProfileStatus | string | null | undefined
): string {
  if (status === "pending" || status === "active" || status === "disabled") {
    return STATUS_HE[status];
  }
  return status || "—";
}

/** Single line for admin/header, e.g. "מדריך/ה · ממתין לאישור". */
export function accountKindLabelHe(
  role: ProfileRole | string | null | undefined,
  status: ProfileStatus | string | null | undefined
): string {
  const r = roleLabelHe(role);
  if (role === "instructor" && status === "pending") {
    return "מדריך/ה ממתין/ה לאישור";
  }
  if (role === "student") return r;
  if (status && status !== "active") {
    return `${r} · ${statusLabelHe(status)}`;
  }
  return r;
}
