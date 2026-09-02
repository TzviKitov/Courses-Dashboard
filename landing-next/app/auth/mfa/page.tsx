import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getUserRole } from "@/lib/auth/types";
import { MFA_SMS_PATH } from "@/lib/auth/mfa-trust";
import MfaClient from "./MfaClient";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirect=/auth/mfa");
  }
  const role = getUserRole(user);
  if (role === "instructor") {
    redirect(MFA_SMS_PATH);
  }
  if (role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<p className="p-8 text-center">טוען…</p>}>
      <MfaClient />
    </Suspense>
  );
}
