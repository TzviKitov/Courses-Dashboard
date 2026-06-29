import { notFound } from "next/navigation";
import { Hero, CourseDetails, RegistrationForm } from "@/components/landing";
import { LandingViewTracker } from "@/components/landing/LandingViewTracker";
import type { LandingPageData } from "@/types/landing";
import { buildGoogleFontUrl } from "@/constants/fonts";
import { adjustColor } from "@/lib/colors";

// Fetch landing data from API (server-side)
async function getLandingData(id: string): Promise<LandingPageData | null> {
  try {
    // In production, use absolute URL or environment variable
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const fetchUrl = `${baseUrl}/api/landing/${id}`;
    const response = await fetch(fetchUrl, {
      cache: "no-store", // Always fetch fresh data
    });

    // #region agent log
    const _dbgLanding = {sessionId:'0fb1a4',location:'l/[id]/page.tsx:getLandingData',message:'SSR landing fetch',data:{id,baseUrl,fetchUrl,status:response.status,ok:response.ok,vercelUrl:process.env.VERCEL_URL??null,hasPublicBaseUrl:Boolean(process.env.NEXT_PUBLIC_BASE_URL)},timestamp:Date.now(),hypothesisId:'B'};
    console.log('[DEBUG-0fb1a4]', JSON.stringify(_dbgLanding));
    fetch('http://127.0.0.1:7491/ingest/37669df7-643b-4d57-8969-24bac38a88d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fb1a4'},body:JSON.stringify(_dbgLanding)}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      return null;
    }

    const landing: LandingPageData = await response.json();
    return landing ?? null;
  } catch (error) {
    // #region agent log
    const _dbgErr = {sessionId:'0fb1a4',location:'l/[id]/page.tsx:getLandingData',message:'SSR landing fetch threw',data:{id,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),hypothesisId:'B'};
    console.log('[DEBUG-0fb1a4]', JSON.stringify(_dbgErr));
    fetch('http://127.0.0.1:7491/ingest/37669df7-643b-4d57-8969-24bac38a88d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fb1a4'},body:JSON.stringify(_dbgErr)}).catch(()=>{});
    // #endregion
    console.error("Failed to fetch landing data:", error);
    return null;
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLandingData(id);

  if (!data) {
    return { title: "דף לא נמצא | CourseFlow" };
  }

  return {
    title: `${data.course.title} | הרשמה לקורס`,
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
  const fontFamily = data.theme?.fontFamily || "Heebo";
  const fontUrl = buildGoogleFontUrl(fontFamily);

  // Get theme colors (extracted from banner or defaults)
  const primaryColor = data.theme?.primary || "#13ecda";
  const accentColor = data.theme?.accent || "#1a1a2e";
  const primaryHover = adjustColor(primaryColor, -15);

  return (
    <>
      <LandingViewTracker landingId={id} />
      {/* Load custom font from Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={fontUrl} rel="stylesheet" />

      {/* Inject theme colors as CSS custom properties */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --primary: ${primaryColor};
              --primary-hover: ${primaryHover};
              --accent: ${accentColor};
            }
          `,
        }}
      />

      {/* Apply font to entire landing page */}
      <div style={{ fontFamily: `'${fontFamily}', sans-serif` }}>
        {/* Hero Section */}
        <Hero
          title={data.course.title}
          description={data.course.description}
          backgroundUrl={data.assets.backgroundUrl}
        />

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Course Info (2/3) */}
            <CourseDetails course={data.course} />

            {/* Registration Form (1/3) */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm sticky top-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">הרשמה לקורס</h2>
                <p className="text-sm text-gray-500 mb-6">מלא את הפרטים ונחזור אליך בהקדם</p>
                <RegistrationForm landingId={data.id} form={data.form} />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-gray-400 text-sm">נוצר באמצעות CourseFlow</p>
          </div>
        </footer>
      </div>
    </>
  );
}
