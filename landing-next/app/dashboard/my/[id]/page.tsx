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
  searchParams: Promise<{ coGuide?: string; created?: string }>;
}) {
  const { id } = await params;
  const { coGuide, created } = await searchParams;

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
    .select("id, owner_id, course, assets, is_public")
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
  const assets = (landing.assets ?? {}) as {
    bannerThumbUrl?: string;
    bannerFullUrl?: string;
    backgroundThumbUrl?: string;
    backgroundFullUrl?: string;
  };
  const downloads = [
    {
      kind: "banner",
      label: "תמונת הבאנר",
      preview: assets.bannerThumbUrl || assets.bannerFullUrl,
      available: Boolean(assets.bannerFullUrl),
    },
    {
      kind: "background",
      label: "תמונת הרקע",
      preview: assets.backgroundThumbUrl || assets.backgroundFullUrl,
      available: Boolean(assets.backgroundFullUrl),
    },
  ] as const;
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
        {created === "1" && (
          <div
            role="status"
            className="rounded-lg border p-4 text-sm space-y-2"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-accent-soft)",
            }}
          >
            <p className="font-bold">הקורס נוצר. כל הכבוד!</p>
            <p>
              <Link href={`/l/${id}`} className="underline">
                לצפייה בדף הנחיתה
              </Link>
              . את תמונות הבאנר והרקע אפשר להוריד כאן למטה.
            </p>
          </div>
        )}
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
        <Section title="תמונות להורדה">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {downloads.map((d) => (
              <div
                key={d.kind}
                className="rounded-lg border p-3 space-y-3"
                style={{ borderColor: "var(--brand-border)" }}
              >
                <p className="text-sm font-bold">{d.label}</p>
                {d.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.preview}
                    alt=""
                    className="w-full h-32 object-cover rounded"
                    loading="lazy"
                  />
                )}
                {d.available ? (
                  <a
                    href={`/api/landings/${id}/download?kind=${d.kind}`}
                    download
                    className="av-btn av-btn-primary"
                  >
                    הורדה (PNG)
                  </a>
                ) : (
                  <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
                    אין תמונה כזאת בקורס.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="עריכה">
          <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
            אפשר לשנות את פרטי הקורס ואת הטקסטים בדף הנחיתה: כותרת, תיאור, תאריכים,
            מיקום, מחיר, לינק תשלום והסתרה מהגלריה.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/my/${id}/edit`} className="av-btn av-btn-primary">
              עריכת הקורס ודף הנחיתה
            </Link>
            <Link
              href={`/dashboard/my/${id}/registrants`}
              className="px-4 h-12 inline-flex items-center rounded-lg border text-sm font-medium"
              style={{ borderColor: "var(--brand-border)" }}
            >
              נרשמים
            </Link>
          </div>
        </Section>

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
