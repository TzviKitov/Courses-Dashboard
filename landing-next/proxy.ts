import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  canCreateCourses,
  isAdmin,
  isPendingInstructor,
} from "@/lib/auth/admin";
import { getPageAuthRequirement, signInRedirectUrl } from "@/lib/auth/guards";
import {
  IDLE_COOKIE,
  INSTRUCTOR_IDLE_MS,
  MFA_ENROLL_PATH,
  MFA_SMS_PATH,
  MFA_TRUST_COOKIE,
  idleCookieOptions,
  isDisabledUser,
} from "@/lib/auth/session-policy";
import { mfaPathForRole, parseMfaTrustCookie } from "@/lib/auth/mfa-trust";
import { getUserRole } from "@/lib/auth/types";

function redirectPreservingCookies(
  url: URL,
  from: NextResponse,
  extra?: (res: NextResponse) => void
): NextResponse {
  const to = NextResponse.redirect(url);
  const pathHeader = from.headers.get("x-pathname");
  if (pathHeader) to.headers.set("x-pathname", pathHeader);
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  extra?.(to);
  return to;
}

/**
 * Refreshes the Supabase auth cookie on each request so server components
 * always see an up-to-date session. Enforces page-level auth when DB mode is on.
 *
 * Note: file is named `proxy.ts` (Next.js 16+) - previously known as
 * `middleware.ts`. See https://nextjs.org/docs/messages/middleware-to-proxy.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const returnPath = `${pathname}${search}`;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const authRequired = getPageAuthRequirement(pathname);

  if (!url || !anonKey) {
    if (
      authRequired === "authenticated" ||
      authRequired === "admin" ||
      authRequired === "instructor"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const response = NextResponse.next({ request });
    response.headers.set("x-pathname", pathname);
    return response;
  }

  let response = NextResponse.next({ request });
  response.headers.set("x-pathname", pathname);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        response = NextResponse.next({ request });
        response.headers.set("x-pathname", pathname);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isDisabledUser(user)) {
    await supabase.auth.signOut();
    const signIn = new URL(signInRedirectUrl(returnPath), request.url);
    signIn.searchParams.set("disabled", "1");
    return redirectPreservingCookies(signIn, response);
  }

  if (
    (authRequired === "authenticated" ||
      authRequired === "admin" ||
      authRequired === "instructor") &&
    !user
  ) {
    const signIn = new URL(signInRedirectUrl(returnPath), request.url);
    return NextResponse.redirect(signIn);
  }

  if (authRequired === "admin" && user && !isAdmin(user)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (authRequired === "instructor" && user) {
    if (isPendingInstructor(user)) {
      return NextResponse.redirect(new URL("/auth/pending", request.url));
    }
    if (!canCreateCourses(user)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const role = getUserRole(user);
  const isStaff = Boolean(user) && (role === "admin" || role === "instructor");

  if (isStaff && user && (authRequired === "admin" || authRequired === "instructor")) {
    const lastRaw = request.cookies.get(IDLE_COOKIE)?.value;
    const last = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();
    if (last && Number.isFinite(last) && now - last > INSTRUCTOR_IDLE_MS) {
      await supabase.auth.signOut();
      const signIn = new URL(signInRedirectUrl(returnPath), request.url);
      signIn.searchParams.set("idle", "1");
      return redirectPreservingCookies(signIn, response, (res) => {
        res.cookies.set(IDLE_COOKIE, "", idleCookieOptions(0));
      });
    }
    response.cookies.set(IDLE_COOKIE, String(now), idleCookieOptions(60 * 60));

    const onMfaPage =
      pathname === MFA_ENROLL_PATH ||
      pathname.startsWith(`${MFA_ENROLL_PATH}/`) ||
      pathname === MFA_SMS_PATH ||
      pathname.startsWith(`${MFA_SMS_PATH}/`);

    if (!onMfaPage && (role === "admin" || role === "instructor")) {
      const trusted = await parseMfaTrustCookie(
        request.cookies.get(MFA_TRUST_COOKIE)?.value,
        { userId: user.id, role }
      );
      if (!trusted) {
        const mfa = new URL(mfaPathForRole(role), request.url);
        mfa.searchParams.set("redirect", returnPath);
        return redirectPreservingCookies(mfa, response);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
