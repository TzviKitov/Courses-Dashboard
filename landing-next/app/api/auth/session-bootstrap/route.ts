import { NextResponse } from "next/server";
import { isPendingInstructor } from "@/lib/auth/admin";
import {
  ensureProfile,
  getProfile,
} from "@/lib/auth/profiles";
import { getCurrentUser } from "@/lib/supabase/ssr";

/**
 * After email/password sign-in or sign-up, ensure a profile row exists and
 * return where the client should navigate.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
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

  if (intent === "instructor_signup") {
    const existing = await getProfile(user.id);
    if (!existing) {
      await ensureProfile({
        userId: user.id,
        displayName,
        role: "instructor",
        status: "pending",
        createdVia: "email",
      });
    } else if (existing.role === "student") {
      // Upgrade request path — still pending instructor approval
      const { updateProfile } = await import("@/lib/auth/profiles");
      await updateProfile(user.id, {
        role: "instructor",
        status: "pending",
        display_name: displayName || existing.display_name,
      });
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

  // login
  let profile = await getProfile(user.id);
  if (!profile) {
    // Legacy Google users migrated by SQL; if missing, create student
    profile = await ensureProfile({
      userId: user.id,
      displayName,
      role: "student",
      status: "active",
      createdVia: "email",
    });
  }

  if (isPendingInstructor(user) || profile?.status === "pending") {
    return NextResponse.json({
      success: true,
      redirect: "/auth/pending",
    });
  }

  return NextResponse.json({ success: true });
}
