import { isAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";

export async function requireAdminApi(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAdmin(user)) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
