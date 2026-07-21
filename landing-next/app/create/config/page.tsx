"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CourseData } from "@/types/course";
import {
  AUDIENCE_CATEGORY_OPTIONS,
  COURSE_TYPE_OPTIONS,
  defaultCourseData,
  formatScheduleDates,
  GENDER_SEPARATION_OPTIONS,
  normalizeSchedule,
  SECTOR_OPTIONS,
} from "@/types/course";
import { BannerPreview } from "@/components/course";
import { HEBREW_FONTS } from "@/constants/fonts";

const STORAGE_KEY = "courseData";

function buildMetadata(details: CourseData["course_details"], price: string) {
  const parsedPrice = price.trim() === "" ? null : Number(price);
  const audienceOption = AUDIENCE_CATEGORY_OPTIONS.find(
    (o) => o.value === details.audience_category
  );

  return {
    start_date: details.schedule.start_date || null,
    price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    sector: details.sector || null,
    target_audience_tags: audienceOption ? [audienceOption.tag] : [],
    course_type: details.course_type || null,
    gender_separation: details.gender_separation || null,
  };
}

export default function LandingConfigPage() {
  const router = useRouter();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [extendedDescription, setExtendedDescription] = useState("");
  const [faqText, setFaqText] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [showPartnerLogos, setShowPartnerLogos] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [requiresInterview, setRequiresInterview] = useState(false);
  const [fontFamily, setFontFamily] = useState("Heebo");
  const [price, setPrice] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      alert("לא נמצאו נתוני קורס. חזור לשלב 1.");
      router.push("/create");
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      const data: CourseData = {
        ...defaultCourseData,
        ...parsed,
        course_details: {
          ...defaultCourseData.course_details,
          ...parsed.course_details,
          schedule: normalizeSchedule(parsed.course_details?.schedule),
        },
      };
      setCourseData(data);

      // Load landing config if exists
      if (data.landing_config) {
        setExtendedDescription(data.landing_config.extended_description || "");
        setRequiresInterview(data.landing_config.requires_interview || false);
        setFaqText(data.landing_config.faq_text || "");
        setSyllabusText(data.landing_config.syllabus_text || "");
        setShowPartnerLogos(Boolean(data.landing_config.show_partner_logos));
        setPaymentLink(data.landing_config.payment_link || "");
      }
      // Load font family if exists
      if (data.branding?.theme?.font_family) {
        setFontFamily(data.branding.theme.font_family);
      }
      // Load dashboard metadata if exists
      if (data.metadata && typeof data.metadata.price === "number") {
        setPrice(String(data.metadata.price));
      }
    } catch (e) {
      console.error("Failed to parse saved course data:", e);
      router.push("/create");
    }
  }, [router]);

  const buildLandingConfig = (overrides?: {
    extended_description?: string;
    requires_interview?: boolean;
    faq_text?: string;
    syllabus_text?: string;
    show_partner_logos?: boolean;
    payment_link?: string;
    font_family?: string;
  }) => ({
    extended_description: overrides?.extended_description ?? extendedDescription,
    requires_interview: overrides?.requires_interview ?? requiresInterview,
    referral_options: ["חבר/ה", "פייסבוק", "גוגל", "אחר"],
    faq_text: overrides?.faq_text ?? faqText,
    syllabus_text: overrides?.syllabus_text ?? syllabusText,
    show_partner_logos: overrides?.show_partner_logos ?? showPartnerLogos,
    payment_link: (overrides?.payment_link ?? paymentLink).trim(),
  });

  const updateLandingConfig = (overrides?: {
    extended_description?: string;
    requires_interview?: boolean;
    faq_text?: string;
    syllabus_text?: string;
    show_partner_logos?: boolean;
    payment_link?: string;
    font_family?: string;
  }) => {
    if (!courseData) return;

    const nextFont = overrides?.font_family ?? fontFamily;

    const updated: CourseData = {
      ...courseData,
      branding: {
        ...courseData.branding,
        theme: {
          ...courseData.branding.theme,
          font_family: nextFont,
        },
      },
      landing_config: buildLandingConfig(overrides),
      metadata: buildMetadata(courseData.course_details, price),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setCourseData(updated);
  };

  const createLandingPage = async () => {
    if (!courseData) return;

    updateLandingConfig();
    setIsCreating(true);

    try {
      const schedule = {
        ...courseData.course_details.schedule,
        dates: formatScheduleDates(
          courseData.course_details.schedule.start_date,
          courseData.course_details.schedule.end_date
        ),
      };

      const response = await fetch("/api/create-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseData: {
            ...courseData,
            course_details: {
              ...courseData.course_details,
              schedule,
            },
            branding: {
              ...courseData.branding,
              theme: {
                ...courseData.branding.theme,
                font_family: fontFamily,
              },
            },
            landing_config: buildLandingConfig(),
            generated_assets: courseData.generated_assets,
            metadata: buildMetadata(courseData.course_details, price),
          },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to create landing page");
      }

      // Save landing page ID and navigate with full page load (avoids stale Router Cache).
      localStorage.setItem("landingPageId", result.landingId);
      window.location.assign(`/l/${result.landingId}`);
    } catch (error) {
      console.error("Error creating landing page:", error);
      alert(
        `שגיאה ביצירת דף נחיתה: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsCreating(false);
    }
  };

  if (!courseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const details = courseData.course_details;
  const assets = courseData.generated_assets;
  const selectedLogos = courseData.branding?.logos || [];
  const hasLogos = selectedLogos.length > 0;
  const sectorLabel =
    SECTOR_OPTIONS.find((o) => o.value === details.sector)?.label || "-";
  const courseTypeLabel =
    COURSE_TYPE_OPTIONS.find((o) => o.value === details.course_type)?.label ||
    "-";
  const genderLabel =
    GENDER_SEPARATION_OPTIONS.find(
      (o) => o.value === details.gender_separation
    )?.label || "-";
  const datesLabel =
    formatScheduleDates(details.schedule.start_date, details.schedule.end_date) ||
    "-";

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-10 max-w-4xl mx-auto">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-gray-900 text-lg font-bold">יצירת דף נחיתה</p>
                <p className="text-gray-500 text-sm">
                  שלב 2 מתוך 2: הגדרות דף נחיתה
                </p>
              </div>
              <span className="text-primary text-sm font-bold">100%</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Settings */}
          <div className="space-y-6">
            {/* Course Summary Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                סיכום ההכשרה
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {details.title || "שם ההכשרה/התוכנית"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {details.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">תאריכים</p>
                    <p className="text-sm font-medium text-gray-900">
                      {datesLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">שעות</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.schedule.time || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">ימים</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.schedule.days || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">מיקום</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.location || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">משך</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.duration || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">קהל יעד</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.target_audience || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">סוג קורס</p>
                    <p className="text-sm font-medium text-gray-900">
                      {courseTypeLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">מגזר</p>
                    <p className="text-sm font-medium text-gray-900">
                      {sectorLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">הפרדה מגדרית</p>
                    <p className="text-sm font-medium text-gray-900">
                      {genderLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">איש קשר</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.contact_phone || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Landing Page Settings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                הגדרות דף נחיתה
              </h2>

              <div className="space-y-6">
                {/* Extended Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    מידע נוסף על הקורס
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    מידע מורחב שיופיע בדף הנחיתה (דרישות קדם, מה נלמד...)
                  </p>
                  <textarea
                    value={extendedDescription}
                    onChange={(e) => setExtendedDescription(e.target.value)}
                    onBlur={updateLandingConfig}
                    rows={6}
                    className="w-full p-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-400"
                    placeholder={`למשל:

מה נלמד בקורס:
• יסודות HTML ו-CSS
• JavaScript מתחילים
• בניית אתר אמיתי

דרישות קדם: אין! מתאים למתחילים מוחלטים`}
                  />
                </div>

                {/* FAQ */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    שאלות נפוצות
                    <span className="text-gray-400 font-normal mr-1">(אופציונלי)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    טקסט חופשי שיופיע בסעיף שאלות נפוצות בדף הנחיתה
                  </p>
                  <textarea
                    value={faqText}
                    onChange={(e) => setFaqText(e.target.value)}
                    onBlur={updateLandingConfig}
                    rows={5}
                    className="w-full p-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-400"
                    placeholder={`למשל:
שאלה: האם צריך ניסיון קודם?
תשובה: לא, הקורס מתאים למתחילים.`}
                  />
                </div>

                {/* Syllabus */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    סילבוס / שלבי התכנית
                    <span className="text-gray-400 font-normal mr-1">(אופציונלי)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    תיאור השלבים או הסילבוס שיופיע בדף הנחיתה
                  </p>
                  <textarea
                    value={syllabusText}
                    onChange={(e) => setSyllabusText(e.target.value)}
                    onBlur={updateLandingConfig}
                    rows={5}
                    className="w-full p-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-400"
                    placeholder={`למשל:
שלב 1: היכרות וכיוון
שלב 2: תרגול מעשי
שלב 3: פרויקט סיום`}
                  />
                </div>

                {/* Partner logos toggle */}
                <div
                  className={`flex items-center justify-between gap-4 ${
                    !hasLogos ? "opacity-60" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      האם לפרסם גם בדף הנחיתה לוגואים של שותפים?
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {hasLogos
                        ? `יוצגו ${selectedLogos.length} הלוגואים שנבחרו ליצירת הבאנר`
                        : "אין לוגואים שנבחרו בשלב 1"}
                    </p>
                  </div>
                  <label
                    className={`relative inline-flex items-center ${
                      hasLogos ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={showPartnerLogos && hasLogos}
                      disabled={!hasLogos}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setShowPartnerLogos(checked);
                        updateLandingConfig({ show_partner_logos: checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50"></div>
                  </label>
                </div>

                {/* Payment link */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    לינק תשלום
                    <span className="text-gray-400 font-normal mr-1">(אופציונלי)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    אם יוזן, יופיע כפתור תשלום בדף הנחיתה
                  </p>
                  <input
                    type="url"
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    onBlur={updateLandingConfig}
                    placeholder="https://"
                    dir="ltr"
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Interview Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      נדרש ראיון קבלה
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      אם מופעל, יתווסף שדה &quot;זמינות לראיון&quot; בטופס
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresInterview}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRequiresInterview(checked);
                        updateLandingConfig({ requires_interview: checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Font Picker */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    פונט עברי לדף הנחיתה
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFontFamily(next);
                      updateLandingConfig({ font_family: next });
                    }}
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                  >
                    <optgroup label="סאנס-סריף">
                      {HEBREW_FONTS.filter((f) => f.category === "sans-serif").map((font) => (
                        <option key={font.id} value={font.name}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="סריף">
                      {HEBREW_FONTS.filter((f) => f.category === "serif").map((font) => (
                        <option key={font.id} value={font.name}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="כותרות">
                      {HEBREW_FONTS.filter((f) => f.category === "display").map((font) => (
                        <option key={font.id} value={font.name}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    הפונט יוחל על כל הטקסט בדף הנחיתה
                  </p>
                </div>

                {/* Referral Options (read-only) */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    אפשרויות &quot;איך הגעת אלינו&quot;
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["חבר/ה", "פייסבוק", "גוגל", "אחר"].map((option) => (
                      <span
                        key={option}
                        className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500"
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Metadata - for filtering in the gallery */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                סינון בדשבורד
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                מגזר וקהל יעד נשמרים משלב 1. כאן אפשר להוסיף מחיר לסינון בגלריה.
              </p>

              <div className="space-y-6">
                <label className="flex flex-col gap-2 max-w-sm">
                  <span className="text-sm font-semibold text-gray-900">
                    מחיר (ש&quot;ח)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    onBlur={updateLandingConfig}
                    placeholder="השאר ריק אם חינם / לא רלוונטי"
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => router.push("/create")}
                className="w-full sm:w-auto px-6 h-12 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400 font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined rtl:rotate-180">
                  arrow_back
                </span>
                חזור לשלב 1
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={createLandingPage}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 h-12 bg-primary hover:opacity-90 text-gray-900 text-base font-bold rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <span>{isCreating ? "יוצר דף נחיתה..." : "צור דף נחיתה"}</span>
                <span className="material-symbols-outlined">rocket_launch</span>
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <BannerPreview
              bannerUrl={assets?.banner_url}
              backgroundUrl={assets?.background_url}
            />
          </div>
        </div>
    </main>
  );
}
