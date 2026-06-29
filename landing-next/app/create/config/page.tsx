"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  CourseData,
  Sector,
  TargetAudienceTag,
} from "@/types/course";
import {
  defaultCourseData,
  SECTOR_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "@/types/course";
import { BannerPreview } from "@/components/course";
import { HEBREW_FONTS } from "@/constants/fonts";

const STORAGE_KEY = "courseData";

/** Pull a YYYY-MM-DD start date from schedule.dates ("YYYY-MM-DD - YYYY-MM-DD"). */
function extractStartDate(dates: string | undefined): string | null {
  if (!dates) return null;
  const first = dates.split(" - ")[0]?.trim();
  if (!first) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(first) ? first : null;
}

export default function LandingConfigPage() {
  const router = useRouter();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [extendedDescription, setExtendedDescription] = useState("");
  const [requiresInterview, setRequiresInterview] = useState(false);
  const [fontFamily, setFontFamily] = useState("Heebo");
  const [price, setPrice] = useState<string>("");
  const [sector, setSector] = useState<Sector | "">("");
  const [audienceTags, setAudienceTags] = useState<TargetAudienceTag[]>([]);
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
      const data = { ...defaultCourseData, ...parsed };
      setCourseData(data);

      // Load landing config if exists
      if (data.landing_config) {
        setExtendedDescription(data.landing_config.extended_description || "");
        setRequiresInterview(data.landing_config.requires_interview || false);
      }
      // Load font family if exists
      if (data.branding?.theme?.font_family) {
        setFontFamily(data.branding.theme.font_family);
      }
      // Load dashboard metadata if exists
      if (data.metadata) {
        if (typeof data.metadata.price === "number") {
          setPrice(String(data.metadata.price));
        }
        if (data.metadata.sector) setSector(data.metadata.sector);
        if (Array.isArray(data.metadata.target_audience_tags)) {
          setAudienceTags(data.metadata.target_audience_tags);
        }
      }
    } catch (e) {
      console.error("Failed to parse saved course data:", e);
      router.push("/create");
    }
  }, [router]);

  const toggleAudienceTag = (tag: TargetAudienceTag) => {
    setAudienceTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const updateLandingConfig = () => {
    if (!courseData) return;

    const parsedPrice = price.trim() === "" ? null : Number(price);

    const updated: CourseData = {
      ...courseData,
      branding: {
        ...courseData.branding,
        theme: {
          ...courseData.branding.theme,
          font_family: fontFamily,
        },
      },
      landing_config: {
        extended_description: extendedDescription,
        requires_interview: requiresInterview,
        referral_options: ["חבר/ה", "פייסבוק", "גוגל", "אחר"],
      },
      metadata: {
        start_date: extractStartDate(courseData.course_details.schedule.dates),
        price: Number.isFinite(parsedPrice) ? parsedPrice : null,
        sector: sector || null,
        target_audience_tags: audienceTags,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setCourseData(updated);
  };

  const createLandingPage = async () => {
    if (!courseData) return;

    updateLandingConfig();
    setIsCreating(true);

    try {
      const parsedPrice = price.trim() === "" ? null : Number(price);
      const response = await fetch("/api/create-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseData: {
            ...courseData,
            branding: {
              ...courseData.branding,
              theme: {
                ...courseData.branding.theme,
                font_family: fontFamily,
              },
            },
            landing_config: {
              extended_description: extendedDescription,
              requires_interview: requiresInterview,
              referral_options: ["חבר/ה", "פייסבוק", "גוגל", "אחר"],
            },
            generated_assets: courseData.generated_assets,
            metadata: {
              start_date: extractStartDate(courseData.course_details.schedule.dates),
              price: Number.isFinite(parsedPrice) ? parsedPrice : null,
              sector: sector || null,
              target_audience_tags: audienceTags,
            },
          },
        }),
      });

      const result = await response.json();

      // #region agent log
      const _dbgClient = {sessionId:'0fb1a4',location:'create/config/page.tsx:createLandingPage',message:'create-landing client response',data:{httpStatus:response.status,success:result.success,landingId:result.landingId,error:result.error},timestamp:Date.now(),hypothesisId:'D'};
      console.log('[DEBUG-0fb1a4]', _dbgClient);
      fetch('http://127.0.0.1:7491/ingest/37669df7-643b-4d57-8969-24bac38a88d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fb1a4'},body:JSON.stringify(_dbgClient)}).catch(()=>{});
      // #endregion

      if (!result.success) {
        throw new Error(result.error || "Failed to create landing page");
      }

      // Save landing page ID
      localStorage.setItem("landingPageId", result.landingId);

      // Navigate to landing page
      router.push(`/l/${result.landingId}`);
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
                סיכום הקורס
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {details.title || "שם הקורס"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {details.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">תאריכים</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.schedule.dates || "-"}
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
                    מידע מורחב שיופיע בדף הנחיתה (סילבוס, דרישות קדם, מה נלמד...)
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
                        setRequiresInterview(e.target.checked);
                        setTimeout(updateLandingConfig, 0);
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
                      setFontFamily(e.target.value);
                      setTimeout(updateLandingConfig, 0);
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
                שדות אלה לא מוצגים בדף הנחיתה, אבל עוזרים למשתמשים בדשבורד למצוא את הקורס.
              </p>

              <div className="space-y-6">
                {/* Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="flex flex-col gap-2">
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

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      מגזר
                    </span>
                    <select
                      value={sector}
                      onChange={(e) => {
                        setSector(e.target.value as Sector | "");
                        setTimeout(updateLandingConfig, 0);
                      }}
                      className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="">לא מסווג</option>
                      {SECTOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Target audience tags */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    קהל יעד (לסינון)
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    בחר אחד או יותר. הטקסט החופשי בעמוד הקורס נשמר בנפרד.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_AUDIENCE_OPTIONS.map((opt) => {
                      const isSelected = audienceTags.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            toggleAudienceTag(opt.value);
                            setTimeout(updateLandingConfig, 0);
                          }}
                          className={`px-4 h-10 rounded-full border-2 text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-primary border-primary text-gray-900"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
