import { NextResponse } from "next/server";
import { isPendingInstructor } from "@/lib/auth/admin";
import {
  ensureProfile,
  getProfile,
  updateProfile,
} from "@/lib/auth/profiles";
import { isDisabledUser } from "@/lib/auth/session-policy";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { logAuditEvent } from "@/lib/security/audit";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";
import type { User } from "@supabase/supabase-js";

function resolveInstructorPhone(
  body: { phone?: string },
  user: User
): string | null {
  if (typeof body.phone === "string" && body.phone.trim()) {
    return normalizeIsraeliPhone(body.phone);
  }
  const meta = user.user_metadata?.phone;
  if (typeof meta === "string") {
    return normalizeIsraeliPhone(meta);
  }
  return null;
}

function wantsInstructorSignup(user: {
  user_metadata?: Record<string, unknown>;
}): boolean {
  return user.user_metadata?.signup_intent === "instructor";
}

/**
 * After email/password sign-in or sign-up, ensure a profile row exists and
 * return where the client should navigate.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "יש להתחבר מחדש כדי להמשיך.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  if (isDisabledUser(user)) {
    try {
      const admin = getSupabaseAdmin();
      await admin.auth.admin.signOut(user.id, "global");
    } catch {
      // ignore
    }
    logAuditEvent({
      actorId: user.id,
      action: "login_failure",
      result: "denied",
      metadata: { reason: "disabled" },
      req,
    });
    return NextResponse.json(
      {
        success: false,
        error: "החשבון הושבת. פנו למנהל המערכת.",
        code: "DISABLED",
      },
      { status: 403 }
    );
  }

  let body: {
    intent?: string;
    displayName?: string;
    phone?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body ok
  }

  const intent = body.intent || "login";
  const displayName =
    body.displayName ||
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    null;

  const instructorPhone = resolveInstructorPhone(body, user);

  if (intent === "instructor_signup") {
    const existing = await getProfile(user.id);
    if (!existing) {
      await ensureProfile({
        userId: user.id,
        displayName,
        role: "instructor",
        status: "pending",
        createdVia: "email",
        phone: instructorPhone,
      });
    } else if (existing.role === "student") {
      await updateProfile(user.id, {
        role: "instructor",
        status: "pending",
        display_name: displayName || existing.display_name,
        phone: instructorPhone || existing.phone,
      });
    } else if (instructorPhone && !existing.phone) {
      await updateProfile(user.id, { phone: instructorPhone });
    }
    return NextResponse.json({
      success: true,
      redirect: "/auth/pending",
    });
  }

  if (intent === "student") {
    await ensureProfile({
      userId: user.id,
      displayName,
      role: "student",
      status: "active",
      createdVia: body.phone ? "phone" : "email",
      phone: body.phone || null,
      preserveElevatedRole: true,
    });
    return NextResponse.json({ success: true });
  }

  // login (and email-confirm return via login)
  let profile = await getProfile(user.id);
  const instructorIntent = wantsInstructorSignup(user);

  if (!profile) {
    if (instructorIntent) {
      profile = await ensureProfile({
        userId: user.id,
        displayName,
        role: "instructor",
        status: "pending",
        createdVia: "email",
        phone: instructorPhone,
      });
      return NextResponse.json({
        success: true,
        redirect: "/auth/pending",
      });
    }
    profile = await ensureProfile({
      userId: user.id,
      displayName,
      role: "student",
      status: "active",
      createdVia: "email",
    });
  } else if (profile.role === "student" && instructorIntent) {
    profile = await updateProfile(user.id, {
      role: "instructor",
      status: "pending",
      display_name: displayName || profile.display_name,
      phone: instructorPhone || profile.phone,
    });
    return NextResponse.json({
      success: true,
      redirect: "/auth/pending",
    });
  }

  if (isPendingInstructor(user) || profile?.status === "pending") {
    return NextResponse.json({
      success: true,
      redirect: "/auth/pending",
    });
  }

  if (profile?.status === "disabled") {
    try {
      const admin = getSupabaseAdmin();
      await admin.auth.admin.signOut(user.id, "global");
    } catch {
      // ignore
    }
    return NextResponse.json(
      {
        success: false,
        error: "החשבון הושבת. פנו למנהל המערכת.",
        code: "DISABLED",
      },
      { status: 403 }
    );
  }

  logAuditEvent({
    actorId: user.id,
    action: "login_success",
    req,
  });

  return NextResponse.json({ success: true });
}
