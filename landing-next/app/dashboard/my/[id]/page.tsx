import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard";
import { assertPageAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { isAdmin, userCanManageLanding } from "@/lib/auth/admin";
import { canEditCoGuides } from "@/lib/landings/co-guide-rules";
import { listCoGuides } from "@/lib/landings/co-guides";
import { CoGuidesPanel } from "./CoGuidesPanel";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5 space-y-4"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
      }}
    >
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ManageCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ coGuide?: string }>;
}) {
  const { id } = await params;
  const { coGuide } = await searchParams;

  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="ניהול קורס">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  await assertPageAccess((await headers()).get("x-pathname") ?? `/dashboard/my/${id}`);

  const user = await getCurrentUser();
  if (!user) return null;

  const { data: landing } = await getSupabaseAdmin()
    .from("landings")
    .select("id, owner_id, course, is_public")
    .eq("id", id)
    .maybeSingle();

  if (!landing || !(await userCanManageLanding(user, id, landing.owner_id))) {
    notFound();
  }

  const guides = await listCoGuides(id);
  const canEditGuides = canEditCoGuides({
    isAdmin: isAdmin(user),
    userId: user.id,
    ownerId: landing.owner_id,
  });
  const title = (landing.course as { title?: string } | null)?.title || "ללא כותרת";

  return (
    <DashboardShell
      title={`ניהול: ${title}`}
      subtitle={landing.is_public ? "הקורס מופיע בגלריה" : "הקורס מוסתר מהגלריה"}
      actions={
        <Link
          href="/dashboard/my"
          className="px-3 py-2 text-xs font-medium rounded-md border hover-nudge"
          style={{
            borderColor: "var(--brand-border)",
            color: "var(--brand-text-muted)",
          }}
        >
          חזרה לקורסים שלי
        </Link>
      }
    >
      <div className="space-y-6 max-w-3xl">
        {coGuide === "failed" && (
          <p
            role="status"
            className="rounded-lg border p-3 text-sm"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-accent-soft)",
            }}
          >
            הקורס נוצר, אבל לא הצלחנו להוסיף את המדריך השותף. אפשר לנסות שוב כאן למטה.
          </p>
        )}
        <Section title="מדריכים שותפים">
          <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
            מדריך שותף רואה את הקורס אצלו ב&quot;הקורסים שלי&quot; ויכול לנהל אותו: נרשמים,
            ייצוא ופעולות נוספות. כדי להוסיף מדריך, הוא צריך להיות רשום באתר.
          </p>
          <CoGuidesPanel
            landingId={id}
            guides={guides}
            canEdit={canEditGuides}
          />
        </Section>
      </div>
    </DashboardShell>
  );
}
