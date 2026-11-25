import { notFound } from "next/navigation";
import { Hero, CourseDetails, LandingRegistration } from "@/components/landing";
import { LandingViewTracker } from "@/components/landing/LandingViewTracker";
import type { LandingPageData } from "@/types/landing";
import { buildGoogleFontUrl, getFontByName, resolveFontFamily } from "@/constants/fonts";
import {
  getAccessibleHoverColor,
  getContrastColor,
  normalizeHex,
} from "@/lib/colors";
import { getLandingById } from "@/lib/landings/get-landing";
import { SITE_NAME } from "@/constants/site";

export const dynamic = "force-dynamic";

async function getLandingData(id: string): Promise<LandingPageData | null> {
  return getLandingById(id);
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLandingData(id);

  if (!data) {
    return { title: "דף לא נמצא" };
  }

  return {
    title: data.course.title,
    description: data.course.description,
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLandingData(id);

  if (!data) {
    notFound();
  }

  // Get font family from theme, default to Heebo
  const storedFont = data.theme?.fontFamily || "Heebo";
  const cssFontFamily = resolveFontFamily(storedFont);
  const catalogFont = getFontByName(storedFont);
  const fontUrl =
    catalogFont?.source === "google" || (!catalogFont && !storedFont.includes(","))
      ? buildGoogleFontUrl(catalogFont?.name || storedFont)
      : "";

  // Get theme colors (extracted from banner or defaults)
  const primaryColor = normalizeHex(data.theme?.primary, "#13ecda");
  const accentColor = normalizeHex(data.theme?.accent, "#1a1a2e");
  const primaryContrast = getContrastColor(primaryColor);
  const primaryHover = getAccessibleHoverColor(
    primaryColor,
    primaryContrast
  );
  const primaryHoverContrast = getContrastColor(primaryHover);

  return (
    <>
      <LandingViewTracker landingId={id} />
      {fontUrl ? (
        <link href={fontUrl} rel="stylesheet" />
      ) : null}

      {/* Inject theme colors as CSS custom properties */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --primary: ${primaryColor};
              --primary-hover: ${primaryHover};
              --primary-contrast: ${primaryContrast};
              --primary-hover-contrast: ${primaryHoverContrast};
              --accent: ${accentColor};
            }
          `,
        }}
      />

      {/* Apply font to entire landing page */}
      <div data-surface="public" className="pb-24 lg:pb-0">
        <div style={{ fontFamily: `${cssFontFamily}, sans-serif` }}>
          <Hero
            title={data.course.title}
            description={data.course.description}
            backgroundUrl={data.assets.backgroundUrl}
          />
        </div>

        <div className="max-w-6xl mx-auto px-4 pt-4 flex justify-end">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium min-h-11"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>
              arrow_forward
            </span>
            חזרה לגלריה
          </a>
        </div>

        <main className="max-w-6xl mx-auto px-4 py-12" style={{ fontFamily: `${cssFontFamily}, sans-serif` }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Course Info (2/3) */}
            <CourseDetails
              course={data.course}
              partnerLogos={data.assets.partnerLogos}
            />

            <LandingRegistration landingId={data.id} form={data.form} />
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 mt-16 border-t" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)" }}>
          <div className="max-w-6xl mx-auto px-4 text-center space-y-2">
            <p className="text-sm">נוצר באמצעות {SITE_NAME}</p>
            <p className="text-sm">
              <a href="/privacy" className="underline">מדיניות פרטיות</a>
              {" · "}
              <a href="/terms" className="underline">תנאי שימוש</a>
              {" · "}
              <a href="/rights" className="underline">עיון / תיקון / מחיקה</a>
              {" · "}
              <a href="/accessibility" className="underline">נגישות</a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
