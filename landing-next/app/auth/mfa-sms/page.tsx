import { redirect } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

// The second login factor was retired. Old links land on their destination.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const sp = await searchParams;
  const back = typeof sp.redirect === "string" ? sp.redirect : "";
  const target = back ? sanitizeRedirectPath(back) : "/dashboard";
  redirect(target.startsWith("/auth/mfa") ? "/dashboard" : target);
}
