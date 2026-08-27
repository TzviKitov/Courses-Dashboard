import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/guards";
import {
  ensureProfile,
  getProfile,
  isEmailOnInstructorAllowlist,
  updateProfile,
} from "@/lib/auth/profiles";
import {
  createSupabaseRouteHandlerClient,
  getAuthOrigin,
} from "@/lib/supabase/ssr";

/**
 * OAuth callback: exchange code, apply intent (instructor/student/login/link), redirect.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const intent = url.searchParams.get("intent") || "login";
  const redirect = sanitizeRedirectPath(
    url.searchParams.get("redirect") || "/dashboard"
  );
  const origin = getAuthOrigin(req);

  if (!code) {
    return NextResponse.redirect(`${origin}${redirect}`);
  }

  let response = NextResponse.redirect(`${origin}${redirect}`);
  response.headers.set("Cache-Control", "private, no-store");

  const supabase = await createSupabaseRouteHandlerClient(response);
  const { data: sessionData, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error || !sessionData.user) {
    console.error("OAuth exchange failed:", error);
    response = NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error?.message || "OAuth failed")}`
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const user = sessionData.user;
  const email = (user.email || "").toLowerCase();
  const provider =
    user.app_metadata?.provider === "azure"
      ? "azure"
      : user.app_metadata?.provider === "google"
        ? "google"
        : (user.app_metadata?.provider as string) || "google";
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    email.split("@")[0] ||
    null;

  // identities may list azure as "azure"
  const isAzure =
    provider === "azure" ||
    user.identities?.some((i) => i.provider === "azure");
  const isGoogle =
    provider === "google" ||
    user.identities?.some((i) => i.provider === "google");

  try {
    const existing = await getProfile(user.id);
    const signupIntentInstructor =
      intent === "instructor_signup" ||
      user.user_metadata?.signup_intent === "instructor";

    // Email-password confirm link (or return after verify) for instructor self-signup
    if (signupIntentInstructor && intent !== "instructor" && intent !== "student") {
      if (
        existing &&
        (existing.role === "admin" ||
          (existing.role === "instructor" && existing.status === "active"))
      ) {
        response = NextResponse.redirect(`${origin}/dashboard/my`);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
      if (!existing) {
        await ensureProfile({
          userId: user.id,
          displayName,
          role: "instructor",
          status: "pending",
          createdVia: "email",
        });
      } else if (existing.role === "student") {
        await updateProfile(user.id, {
          role: "instructor",
          status: "pending",
          display_name: existing.display_name || displayName,
        });
      }
      response = NextResponse.redirect(`${origin}/auth/pending`);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    if (intent === "instructor") {
      if (isAzure && email && (await isEmailOnInstructorAllowlist(email))) {
        if (existing) {
          await updateProfile(user.id, {
            role: existing.role === "admin" ? "admin" : "instructor",
            status: "active",
            display_name: existing.display_name || displayName,
            created_via: existing.created_via || "azure",
          });
        } else {
          await ensureProfile({
            userId: user.id,
            displayName,
            role: "instructor",
            status: "active",
            createdVia: "azure",
          });
        }
        response = NextResponse.redirect(`${origin}/dashboard/my`);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }

      if (isGoogle) {
        // Google does not create new instructors — must already exist / be approved
        if (
          existing &&
          (existing.role === "instructor" || existing.role === "admin") &&
          existing.status === "active"
        ) {
          response = NextResponse.redirect(`${origin}${redirect}`);
          response.headers.set("Cache-Control", "private, no-store");
          return response;
        }
        response = NextResponse.redirect(
          `${origin}/auth/register?error=${encodeURIComponent(
            "Google אינו פותח הרשמת מדריך. הירשם במייל או Microsoft, או בקש הזמנה ממנהל."
          )}`
        );
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }

      // Azure but not on allowlist
      if (isAzure) {
        response = NextResponse.redirect(
          `${origin}/auth/register?error=${encodeURIComponent(
            "המייל אינו ברשימת האגף. הירשם במייל+סיסמה לאישור מנהל, או פנה למנהל."
          )}`
        );
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    }

    if (intent === "student") {
      await ensureProfile({
        userId: user.id,
        displayName,
        role: "student",
        status: "active",
        createdVia: isAzure ? "azure" : isGoogle ? "google" : "email",
        preserveElevatedRole: true,
      });
      response = NextResponse.redirect(`${origin}${redirect}`);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    // login / link — ensure profile for legacy users
    if (!existing) {
      // First-time Google/Azure login without intent: treat as student unless allowlisted instructor
      if (isAzure && email && (await isEmailOnInstructorAllowlist(email))) {
        await ensureProfile({
          userId: user.id,
          displayName,
          role: "instructor",
          status: "active",
          createdVia: "azure",
        });
        response = NextResponse.redirect(`${origin}/dashboard/my`);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
      await ensureProfile({
        userId: user.id,
        displayName,
        role: "student",
        status: "active",
        createdVia: isAzure ? "azure" : "google",
      });
    } else if (existing.status === "pending") {
      response = NextResponse.redirect(`${origin}/auth/pending`);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  } catch (e) {
    console.error("OAuth post-callback profile handling failed:", e);
  }

  return response;
}
