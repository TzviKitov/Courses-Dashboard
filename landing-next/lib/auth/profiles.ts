import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  ProfileCreatedVia,
  ProfileRole,
  ProfileRow,
  ProfileStatus,
} from "@/lib/auth/types";
import { getUserRole, getUserStatus } from "@/lib/auth/types";

export type { ProfileRow, ProfileRole, ProfileStatus, ProfileCreatedVia };

const PROFILE_SELECT =
  "id, display_name, role, status, can_view_all_learners, phone, created_via, requested_all_learners_at, created_at, updated_at";

/** Sync role/status into auth app_metadata so JWT + is_admin() stay correct. */
export async function syncAuthAppMetadata(
  userId: string,
  role: ProfileRole,
  status: ProfileStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !data.user) {
    console.error("[profiles] getUserById failed:", getErr);
    return;
  }
  const prev = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...prev,
      ...extra,
      role,
      status,
    },
  });
  if (error) {
    console.error("[profiles] syncAuthAppMetadata failed:", error);
  }
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[profiles] getProfile:", error);
    return null;
  }
  return data as ProfileRow | null;
}

export async function ensureProfile(opts: {
  userId: string;
  displayName?: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  createdVia?: ProfileCreatedVia | null;
  phone?: string | null;
  /** If profile exists, do not downgrade role (e.g. student signup on existing instructor). */
  preserveElevatedRole?: boolean;
}): Promise<ProfileRow | null> {
  const existing = await getProfile(opts.userId);
  if (existing) {
    if (opts.preserveElevatedRole) {
      const rank = { student: 0, instructor: 1, admin: 2 } as const;
      if (rank[existing.role] >= rank[opts.role]) {
        return existing;
      }
    }
    return existing;
  }

  const admin = getSupabaseAdmin();
  const row = {
    id: opts.userId,
    display_name: opts.displayName ?? null,
    role: opts.role,
    status: opts.status,
    created_via: opts.createdVia ?? null,
    phone: opts.phone ?? null,
  };
  const { data, error } = await admin
    .from("profiles")
    .insert(row)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    // Race: another request inserted first
    if (error.code === "23505") {
      return getProfile(opts.userId);
    }
    console.error("[profiles] ensureProfile insert:", error);
    return null;
  }

  await syncAuthAppMetadata(opts.userId, opts.role, opts.status);
  return data as ProfileRow;
}

export async function updateProfile(
  userId: string,
  patch: Partial<{
    display_name: string | null;
    role: ProfileRole;
    status: ProfileStatus;
    can_view_all_learners: boolean;
    phone: string | null;
    created_via: ProfileCreatedVia | null;
    requested_all_learners_at: string | null;
  }>
): Promise<ProfileRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    console.error("[profiles] updateProfile:", error);
    return null;
  }

  const row = data as ProfileRow;
  if (patch.role !== undefined || patch.status !== undefined) {
    await syncAuthAppMetadata(userId, row.role, row.status);
  }
  return row;
}

export function profileFromUserClaims(user: User): {
  role: ProfileRole | null;
  status: ProfileStatus | null;
} {
  return { role: getUserRole(user), status: getUserStatus(user) };
}

export async function isEmailOnInstructorAllowlist(
  email: string
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("instructor_email_allowlist")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    console.error("[profiles] allowlist check:", error);
    return false;
  }
  return Boolean(data);
}

export async function listLandingInstructorIds(
  landingId: string
): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("landing_instructors")
    .select("user_id")
    .eq("landing_id", landingId);
  if (error) {
    console.error("[profiles] listLandingInstructorIds:", error);
    return [];
  }
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}

/**
 * True if instructor is owner or co-instructor of a landing that student
 * registered for (used for can_view_all_learners scope).
 */
export async function instructorRelatedToLearner(
  instructorId: string,
  learnerUserId: string
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: regs, error } = await admin
    .from("registrations")
    .select("landing_id")
    .eq("user_id", learnerUserId)
    .is("cancelled_at", null);

  if (error || !regs?.length) return false;

  const landingIds = [...new Set(regs.map((r: { landing_id: string }) => r.landing_id))];

  const { data: owned } = await admin
    .from("landings")
    .select("id")
    .eq("owner_id", instructorId)
    .in("id", landingIds)
    .limit(1);

  if (owned?.length) return true;

  const { data: co } = await admin
    .from("landing_instructors")
    .select("landing_id")
    .eq("user_id", instructorId)
    .in("landing_id", landingIds)
    .limit(1);

  return Boolean(co?.length);
}
