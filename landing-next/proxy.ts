import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { getPageAuthRequirement, signInRedirectUrl } from "@/lib/auth/guards";

/**
 * Refreshes the Supabase auth cookie on each request so server components
 * always see an up-to-date session. Enforces page-level auth when DB mode is on.
 *
 * Skipped if Supabase env vars are missing (early development).
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
    if (authRequired === "authenticated" || authRequired === "admin") {
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

  if (
    (authRequired === "authenticated" || authRequired === "admin") &&
    !user
  ) {
    const signIn = new URL(signInRedirectUrl(returnPath), request.url);
    return NextResponse.redirect(signIn);
  }

  if (authRequired === "admin" && user && !isAdmin(user)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
