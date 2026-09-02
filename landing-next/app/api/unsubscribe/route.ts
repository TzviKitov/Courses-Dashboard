import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";

/** Public unsubscribe for marketing emails (spam law 30A). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const phoneRaw = url.searchParams.get("phone")?.trim();
  if (!isSupabaseDbEnabled()) {
    return new Response("שירות לא זמין", { status: 503 });
  }
  if (!email && !phoneRaw) {
    return new Response("חסר מזהה", { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (email) {
    await admin
      .from("registrations")
      .update({ marketing_opt_in: false })
      .eq("email", email);
  }
  const phone = phoneRaw ? normalizeIsraeliPhone(phoneRaw) : null;
  if (phone) {
    await admin
      .from("registrations")
      .update({ marketing_opt_in: false })
      .eq("phone", phone);
  }
  return new Response("הוסרת מרשימת העדכונים השיווקיים.", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
