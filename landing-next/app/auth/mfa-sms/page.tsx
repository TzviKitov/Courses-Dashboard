import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getProfile } from "@/lib/auth/profiles";
import { getUserRole } from "@/lib/auth/types";
import { MFA_ENROLL_PATH } from "@/lib/auth/mfa-trust";
import { toIsraeliLocalPhone } from "@/lib/auth/phone";
import MfaSmsClient from "./MfaSmsClient";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirect=/auth/mfa-sms");
  }
  const role = getUserRole(user);
  if (role === "admin") {
    redirect(MFA_ENROLL_PATH);
  }
  if (role !== "instructor") {
    redirect("/dashboard");
  }

  const profile = await getProfile(user.id);
  const local = profile?.phone ? toIsraeliLocalPhone(profile.phone) : null;
  const initialMasked = local ? `****${local.slice(-4)}` : null;

  return (
    <Suspense fallback={<p className="p-8 text-center">טוען…</p>}>
      <MfaSmsClient initialMasked={initialMasked} />
    </Suspense>
  );
}
