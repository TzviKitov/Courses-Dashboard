"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  AudienceCategory,
  CourseData,
  CourseType,
  GenderSeparation,
  Logo,
  Sector,
} from "@/types/course";
import {
  AUDIENCE_CATEGORY_OPTIONS,
  COURSE_TYPE_OPTIONS,
  defaultCourseData,
  formatScheduleDates,
  GENDER_SEPARATION_OPTIONS,
  normalizeDesignPreferences,
  normalizeSchedule,
  SECTOR_OPTIONS,
  type DesignPreferences,
} from "@/types/course";
import { getFontById } from "@/constants/fonts";
import { LogoPicker } from "./LogoPicker";
import { BannerPreview } from "./BannerPreview";
import { DesignGuidePanel } from "./design/DesignGuidePanel";

const STORAGE_KEY = "courseData";
const STORAGE_VERSION_KEY = "courseDataVersion";
// Bump this when the on-disk shape changes incompatibly so old clients reset.
// v2: switched from base64/blob asset URLs to Supabase Storage URLs.
// v3: structured schedule dates + program contact / classification fields.
// v4: style-guide design preferences (source/upload, palettes, fonts, compositions).
const CURRENT_STORAGE_VERSION = "4";

function hydrateCourseData(parsed: Partial<CourseData>): CourseData {
  const merged = { ...defaultCourseData, ...parsed };
  const details = {
    ...defaultCourseData.course_details,
    ...parsed.course_details,
    schedule: normalizeSchedule(parsed.course_details?.schedule),
  };
  const design_preferences = normalizeDesignPreferences(
    parsed.design_preferences as Partial<DesignPreferences> | undefined
  );
  const bannerFont = getFontById(design_preferences.fonts.banner_font_id);
  return {
    ...merged,
    course_details: details,
    design_preferences,
    branding: {
      ...defaultCourseData.branding,
      ...parsed.branding,
      theme: {
        ...defaultCourseData.branding.theme,
        ...parsed.branding?.theme,
        font_family:
          parsed.branding?.theme?.font_family ||
          bannerFont?.name ||
          defaultCourseData.branding.theme.font_family,
        overrides: {
          ...defaultCourseData.branding.theme.overrides,
          ...parsed.branding?.theme?.overrides,
        },
      },
    },
    generated_assets: {
      ...defaultCourseData.generated_assets,
      ...parsed.generated_assets,
    },
  };
}

/**
 * Strip any legacy data:* or blob:* asset URLs that older versions of the app
 * may have stored. Returns a sanitized copy.
 */
function sanitizeStoredAssets(data: CourseData): CourseData {
  const assets = data.generated_assets || {};
  const isClean = (url: string | undefined) =>
    !url || (!url.startsWith("data:") && !url.startsWith("blob:"));
  return {
    ...data,
    generated_assets: {
      banner_url: isClean(assets.banner_url) ? assets.banner_url : "",
      banner_thumb_url: isClean(assets.banner_thumb_url)
        ? assets.banner_thumb_url
        : "",
      background_url: isClean(assets.background_url) ? assets.background_url : "",
      background_thumb_url: isClean(assets.background_thumb_url)
        ? assets.background_thumb_url
        : "",
      session_id: assets.session_id,
    },
  };
}

export function CourseForm() {
  const router = useRouter();
  const [courseData, setCourseData] = useState<CourseData>(defaultCourseData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bannerStatus, setBannerStatus] = useState("");
  const [bannerProgress, setBannerProgress] = useState(0);
  const [bannerError, setBannerError] = useState("");
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const bannerAbortRef = useRef<AbortController | null>(null);

  const cancelBannerGeneration = useCallback(() => {
    bannerAbortRef.current?.abort();
  }, []);

  // Abort in-flight generation if the user leaves the page mid-create.
  useEffect(() => {
    return () => {
      bannerAbortRef.current?.abort();
    };
  }, []);

  // Load from localStorage on mount, migrating older stored shapes.
  useEffect(() => {
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);

    if (storedVersion !== CURRENT_STORAGE_VERSION && saved) {
      // Legacy data may contain ~5 MB of base64 images. Drop assets only,
      // keep textual fields so the user doesn't lose their typed content.
      try {
        const parsed = JSON.parse(saved);
        const cleaned = sanitizeStoredAssets(hydrateCourseData(parsed));
        setCourseData(cleaned);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
      setIsMounted(true);
      return;
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCourseData(sanitizeStoredAssets(hydrateCourseData(parsed)));
      } catch (e) {
        console.error("Failed to parse saved course data:", e);
      }
    }
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
    setIsMounted(true);
  }, []);

  // Save to localStorage on change
  const saveToStorage = useCallback((data: CourseData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const updateCourseDetails = (
    field: keyof CourseData["course_details"],
    value: string
  ) => {
    setCourseData((prev) => {
      // Clear banner if title or description changes (affects banner content)
      const shouldClearBanner = field === "title" || field === "description";
      const updated = {
        ...prev,
        course_details: { ...prev.course_details, [field]: value },
        ...(shouldClearBanner && {
          generated_assets: {
            ...prev.generated_assets,
            banner_url: "",
            background_url: "",
          },
        }),
      };
      saveToStorage(updated);
      return updated;
    });
  };

  const updateSchedule = (
    field: keyof CourseData["course_details"]["schedule"],
    value: string
  ) => {
    setCourseData((prev) => {
      const nextSchedule = {
        ...prev.course_details.schedule,
        [field]: value,
      };
      if (field === "start_date" || field === "end_date") {
        nextSchedule.dates = formatScheduleDates(
          field === "start_date" ? value : nextSchedule.start_date,
          field === "end_date" ? value : nextSchedule.end_date
        );
      }
      const updated = {
        ...prev,
        course_details: {
          ...prev.course_details,
          schedule: nextSchedule,
        },
      };
      saveToStorage(updated);
      return updated;
    });
  };

  const updateAudienceCategory = (value: AudienceCategory | "") => {
    const option = AUDIENCE_CATEGORY_OPTIONS.find((o) => o.value === value);
    setCourseData((prev) => {
      const updated = {
        ...prev,
        course_details: {
          ...prev.course_details,
          audience_category: value,
          target_audience: option?.label || "",
        },
      };
      saveToStorage(updated);
      return updated;
    });
  };

  const updateDesignPreferences = (next: DesignPreferences) => {
    setCourseData((prev) => {
      const bannerFont = getFontById(next.fonts.banner_font_id);
      const updated: CourseData = {
        ...prev,
        design_preferences: next,
        branding: {
          ...prev.branding,
          theme: {
            ...prev.branding.theme,
            font_family:
              next.fonts.landing_font_mode === "same"
                ? bannerFont?.name || prev.branding.theme.font_family
                : prev.branding.theme.font_family,
          },
        },
        generated_assets: {
          ...prev.generated_assets,
          banner_url: "",
          banner_thumb_url: "",
          background_url: "",
          background_thumb_url: "",
        },
      };
      saveToStorage(updated);
      return updated;
    });
  };

  const updateLogos = (logos: Logo[]) => {
    setCourseData((prev) => {
      const updated = {
        ...prev,
        branding: {
          ...prev.branding,
          logos,
          logo: logos[0] || null, // Keep backward compatibility
        },
        // Clear cached banner when logos change
        generated_assets: {
          ...prev.generated_assets,
          banner_url: "",
          background_url: "",
        },
      };
      saveToStorage(updated);
      return updated;
    });
  };

  const validateForm = (): boolean => {
    setShowValidation(true);
    const d = courseData.course_details;
    const fields = [
      { value: d.title, label: "שם ההכשרה/התוכנית" },
      { value: d.description, label: "תיאור הקורס" },
      { value: d.audience_category, label: "קהל יעד" },
      { value: d.schedule.start_date, label: "תאריך פתיחה" },
      { value: d.instructor_name, label: "שם המדריך" },
      { value: d.organization, label: "ארגון" },
      { value: d.role, label: "תפקיד" },
      { value: d.contact_phone, label: "טלפון ליצירת קשר" },
      { value: d.course_type, label: "סוג קורס" },
      { value: d.sector, label: "מגזר" },
      { value: d.gender_separation, label: "הפרדה מגדרית" },
    ];

    const firstMissing = fields.find((field) => !field.value.trim());
    if (firstMissing) {
      // Defer scroll until red borders are painted.
      requestAnimationFrame(() => {
        document
          .querySelector(".field-invalid")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      alert("חסרים שדות חובה (מוקפים באדום)");
      return false;
    }
    return true;
  };

  const fieldClass = (value: string, extra = "") => {
    const missing = showValidation && !value.trim();
    return [
      "w-full rounded-lg border bg-white text-gray-900 focus:ring-2 focus:border-transparent outline-none transition-all",
      missing
        ? "border-red-500 focus:ring-red-400 field-invalid"
        : "border-gray-200 focus:ring-primary",
      extra,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const generateBanner = async () => {
    if (!validateForm()) return;

    const prefs = courseData.design_preferences;

    if (prefs.source === "upload" && !prefs.uploaded_flyer_url) {
      alert("יש להעלות פלאייר / תמונה לפני המשך");
      return;
    }

    // Upload + same image for landing: no AI call
    if (prefs.source === "upload" && prefs.background_mode === "same_as_flyer") {
      const flyer = prefs.uploaded_flyer_url!;
      const thumb = prefs.uploaded_flyer_thumb_url || flyer;
      setCourseData((prev) => {
        const updated = {
          ...prev,
          generated_assets: {
            ...prev.generated_assets,
            banner_url: flyer,
            banner_thumb_url: thumb,
            background_url: flyer,
            background_thumb_url: thumb,
            session_id: prev.generated_assets.session_id,
          },
        };
        saveToStorage(updated);
        return updated;
      });
      setBannerStatus("התמונה הוגדרה כבאנר ורקע");
      setBannerProgress(100);
      setBannerError("");
      return;
    }

    // Cancel any previous in-flight generation before starting a new one.
    bannerAbortRef.current?.abort();
    const abortController = new AbortController();
    bannerAbortRef.current = abortController;

    setIsGenerating(true);
    setBannerStatus(
      prefs.source === "upload"
        ? "שולח בקשה ליצירת רקע..."
        : "שולח בקשה ליצירת באנר..."
    );
    setBannerProgress(0);
    setBannerError("");
    setGenerationStartTime(Date.now());

    // Clear old banner before generating new one
    setCourseData((prev) => {
      const updated = {
        ...prev,
        generated_assets: {
          ...prev.generated_assets,
          banner_url:
            prefs.source === "upload" ? prefs.uploaded_flyer_url || "" : "",
          banner_thumb_url:
            prefs.source === "upload"
              ? prefs.uploaded_flyer_thumb_url || ""
              : "",
          background_url: "",
          background_thumb_url: "",
          session_id:
            prefs.source === "upload"
              ? prev.generated_assets.session_id
              : undefined,
        },
      };
      saveToStorage(updated);
      return updated;
    });

    try {
      const response = await fetch("/api/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          course: {
            title_he: courseData.course_details.title,
            subtitle_he: courseData.course_details.description.slice(0, 80),
            duration: courseData.course_details.duration,
            schedule: {
              ...courseData.course_details.schedule,
              dates: formatScheduleDates(
                courseData.course_details.schedule.start_date,
                courseData.course_details.schedule.end_date
              ),
            },
            location: courseData.course_details.location,
          },
          design: prefs,
          branding: {
            logos: courseData.branding.logos || [],
            colors: {
              primary: courseData.branding.theme.overrides.primary,
              accent: courseData.branding.theme.overrides.accent,
            },
          },
          sessionId: courseData.generated_assets.session_id,
        }),
      });

      if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
        const errResult = await response.json();
        throw new Error(errResult.error || "Banner generation failed");
      }

      if (!response.body) {
        throw new Error("No response stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (abortController.signal.aborted) {
          await reader.cancel().catch(() => {});
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(dataLine.slice(6));

            if (event.type === "progress") {
              setBannerStatus(event.message);
              setBannerProgress(event.progress);
            } else if (event.type === "retry") {
              setBannerStatus(event.message);
            } else if (event.type === "result" && event.ok) {
              const { banner, bannerThumb, background, backgroundThumb, sessionId, colors } = event;

              setCourseData((prev) => {
                const updated = {
                  ...prev,
                  generated_assets: {
                    ...prev.generated_assets,
                    banner_url: banner,
                    banner_thumb_url: bannerThumb,
                    background_url: background,
                    background_thumb_url: backgroundThumb,
                    session_id: sessionId,
                  },
                  branding: {
                    ...prev.branding,
                    theme: {
                      ...prev.branding.theme,
                      colors: colors
                        ? { primary: colors.primary, accent: colors.accent }
                        : prev.branding.theme.colors,
                    },
                  },
                };
                saveToStorage(updated);
                return updated;
              });

              setBannerStatus("באנר נוצר בהצלחה!");
              setBannerProgress(100);
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
              throw parseErr;
            }
          }
        }
      }
    } catch (error) {
      const isAbort =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");

      if (isAbort || abortController.signal.aborted) {
        setBannerStatus("");
        setBannerProgress(0);
        setBannerError("");
      } else {
        console.error("Banner generation error:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setBannerError(msg);
        setBannerStatus("");
        setBannerProgress(0);
      }
    } finally {
      if (bannerAbortRef.current === abortController) {
        bannerAbortRef.current = null;
      }
      setIsGenerating(false);
      setGenerationStartTime(null);
    }
  };

  const goToNextStep = () => {
    if (!validateForm()) return;

    const prefs = courseData.design_preferences;
    const assets = courseData.generated_assets;

    if (prefs.source === "upload" && !prefs.uploaded_flyer_url) {
      alert("יש להעלות פלאייר / תמונה לפני המשך");
      return;
    }

    if (prefs.source === "upload" && prefs.background_mode === "same_as_flyer") {
      if (!assets.banner_url) {
        // Auto-apply uploaded flyer as banner+background
        const flyer = prefs.uploaded_flyer_url!;
        const thumb = prefs.uploaded_flyer_thumb_url || flyer;
        const updated = {
          ...courseData,
          generated_assets: {
            ...assets,
            banner_url: flyer,
            banner_thumb_url: thumb,
            background_url: flyer,
            background_thumb_url: thumb,
          },
        };
        setIsSaving(true);
        saveToStorage(updated);
        router.push("/create/config");
        return;
      }
    } else if (!assets.banner_url && !assets.background_url) {
      const ok = confirm(
        "עדיין לא נוצרו באנר/רקע. להמשיך בכל זאת לדף ההגדרות?"
      );
      if (!ok) return;
    }

    setIsSaving(true);
    saveToStorage(courseData);

    // Navigate to config page
    router.push("/create/config");
  };

  // Show loading state until client-side hydration is complete
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* Form Section */}
      <div className="flex-1 w-full lg:w-2/3 space-y-8">
        <form className="space-y-8">
          {/* Course Details */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                פרטי ההכשרה
              </h1>
              <p className="text-gray-500">
                מלא את הפרטים הבסיסיים של ההכשרה/התוכנית. פרטים אלו יופיעו בדף
                הקורס ובחומרי השיווק.
              </p>
            </div>

            <div className="space-y-6">
              {/* Title */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  שם ההכשרה/התוכנית <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={courseData.course_details.title}
                  onChange={(e) => updateCourseDetails("title", e.target.value)}
                  className={fieldClass(
                    courseData.course_details.title,
                    "h-12 px-4 placeholder:text-gray-400"
                  )}
                  placeholder="למשל: יסודות העיצוב הגרפי"
                  required
                />
              </label>

              {/* Description */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  תיאור הקורס <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={courseData.course_details.description}
                  onChange={(e) =>
                    updateCourseDetails("description", e.target.value)
                  }
                  className={fieldClass(
                    courseData.course_details.description,
                    "p-4 resize-none placeholder:text-gray-400"
                  )}
                  placeholder="פרט על מה נלמד בקורס, למי הוא מתאים ומה הערך המוסף..."
                  rows={4}
                  required
                />
              </label>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    תאריך פתיחה <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="date"
                    value={courseData.course_details.schedule.start_date}
                    onChange={(e) => updateSchedule("start_date", e.target.value)}
                    className={fieldClass(
                      courseData.course_details.schedule.start_date,
                      "h-12 px-4"
                    )}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    תאריך סיום משוער
                  </span>
                  <input
                    type="date"
                    value={courseData.course_details.schedule.end_date}
                    onChange={(e) => updateSchedule("end_date", e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                  <span className="text-xs text-gray-400">
                    ניתן להשאיר ריק אם התוכנית פתוחה על השנה
                  </span>
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  תאריך ראיונות / החלטת קבלה
                </span>
                <input
                  type="date"
                  value={courseData.course_details.schedule.interview_date}
                  onChange={(e) =>
                    updateSchedule("interview_date", e.target.value)
                  }
                  className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </label>

              {/* Instructor / org metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    שם המדריך <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={courseData.course_details.instructor_name}
                    onChange={(e) =>
                      updateCourseDetails("instructor_name", e.target.value)
                    }
                    className={fieldClass(
                      courseData.course_details.instructor_name,
                      "h-12 px-4 placeholder:text-gray-400"
                    )}
                    placeholder="שם מלא"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    ארגון <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={courseData.course_details.organization}
                    onChange={(e) =>
                      updateCourseDetails("organization", e.target.value)
                    }
                    className={fieldClass(
                      courseData.course_details.organization,
                      "h-12 px-4 placeholder:text-gray-400"
                    )}
                    placeholder="שם הארגון"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    תפקיד <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={courseData.course_details.role}
                    onChange={(e) =>
                      updateCourseDetails("role", e.target.value)
                    }
                    className={fieldClass(
                      courseData.course_details.role,
                      "h-12 px-4 placeholder:text-gray-400"
                    )}
                    placeholder="למשל: רכז/ת תוכנית"
                    required
                  />
                </label>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    טלפון ליצירת קשר <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="tel"
                    value={courseData.course_details.contact_phone}
                    onChange={(e) =>
                      updateCourseDetails("contact_phone", e.target.value)
                    }
                    className={fieldClass(
                      courseData.course_details.contact_phone,
                      "h-12 px-4 placeholder:text-gray-400"
                    )}
                    placeholder="050-0000000"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    אימייל ליצירת קשר
                  </span>
                  <input
                    type="email"
                    value={courseData.course_details.contact_email}
                    onChange={(e) =>
                      updateCourseDetails("contact_email", e.target.value)
                    }
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                    placeholder="name@example.com"
                  />
                </label>
              </div>

              {/* Course type */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  סוג קורס <span className="text-red-500">*</span>
                </span>
                <select
                  value={courseData.course_details.course_type}
                  onChange={(e) =>
                    updateCourseDetails(
                      "course_type",
                      e.target.value as CourseType | ""
                    )
                  }
                  className={fieldClass(
                    courseData.course_details.course_type,
                    "h-12 px-4"
                  )}
                  required
                >
                  <option value="">בחר סוג קורס</option>
                  {COURSE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Duration & Target Audience */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    מספר מפגשים
                  </span>
                  <select
                    value={courseData.course_details.duration}
                    onChange={(e) =>
                      updateCourseDetails("duration", e.target.value)
                    }
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="">לא צוין</option>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={`${num} מפגשים`}>
                        {num} {num === 1 ? "מפגש" : "מפגשים"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    קהל יעד <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={courseData.course_details.audience_category}
                    onChange={(e) =>
                      updateAudienceCategory(
                        e.target.value as AudienceCategory | ""
                      )
                    }
                    className={fieldClass(
                      courseData.course_details.audience_category,
                      "h-12 px-4"
                    )}
                    required
                  >
                    <option value="">בחר קהל יעד</option>
                    {AUDIENCE_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  טווח גילאים
                </span>
                <input
                  type="text"
                  value={courseData.course_details.age_range}
                  onChange={(e) =>
                    updateCourseDetails("age_range", e.target.value)
                  }
                  className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                  placeholder="למשל: 16–18 / 18–25"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    מגזר <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={courseData.course_details.sector}
                    onChange={(e) =>
                      updateCourseDetails(
                        "sector",
                        e.target.value as Sector | ""
                      )
                    }
                    className={fieldClass(
                      courseData.course_details.sector,
                      "h-12 px-4"
                    )}
                    required
                  >
                    <option value="">בחר מגזר</option>
                    {SECTOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    האם הקורס בהפרדה מגדרית?{" "}
                    <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={courseData.course_details.gender_separation}
                    onChange={(e) =>
                      updateCourseDetails(
                        "gender_separation",
                        e.target.value as GenderSeparation | ""
                      )
                    }
                    className={fieldClass(
                      courseData.course_details.gender_separation,
                      "h-12 px-4"
                    )}
                    required
                  >
                    <option value="">בחר</option>
                    {GENDER_SEPARATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Schedule - Days */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">ימים</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "ראשון", label: "א׳" },
                    { value: "שני", label: "ב׳" },
                    { value: "שלישי", label: "ג׳" },
                    { value: "רביעי", label: "ד׳" },
                    { value: "חמישי", label: "ה׳" },
                    { value: "שישי", label: "ו׳" },
                  ].map((day) => {
                    const selectedDays = courseData.course_details.schedule.days
                      .split(", ")
                      .filter(Boolean);
                    const isSelected = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const newDays = isSelected
                            ? selectedDays.filter((d) => d !== day.value)
                            : [...selectedDays, day.value];
                          updateSchedule("days", newDays.join(", "));
                        }}
                        className={`w-12 h-12 rounded-lg border-2 font-semibold hover-chip ${
                          isSelected
                            ? "bg-primary border-primary text-gray-900"
                            : "bg-white border-gray-200 text-gray-600"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schedule - Time (optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    שעת התחלה
                  </span>
                  <input
                    type="time"
                    value={
                      courseData.course_details.schedule.time.split("-")[0] || ""
                    }
                    onChange={(e) => {
                      const endTime =
                        courseData.course_details.schedule.time.split("-")[1] ||
                        "";
                      const newTime = endTime
                        ? `${e.target.value}-${endTime}`
                        : e.target.value;
                      updateSchedule("time", newTime);
                    }}
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    שעת סיום
                  </span>
                  <input
                    type="time"
                    value={
                      courseData.course_details.schedule.time.split("-")[1] || ""
                    }
                    onChange={(e) => {
                      const startTime =
                        courseData.course_details.schedule.time.split("-")[0] ||
                        "";
                      const newTime = startTime
                        ? `${startTime}-${e.target.value}`
                        : e.target.value;
                      updateSchedule("time", newTime);
                    }}
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </label>
              </div>

              {/* Location */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-900">מיקום</span>
                <input
                  type="text"
                  value={courseData.course_details.location}
                  onChange={(e) =>
                    updateCourseDetails("location", e.target.value)
                  }
                  className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                  placeholder="למשל: זום / תל אביב, דרך בגין 12"
                />
              </label>
            </div>
          </div>

          {/* Design Preferences */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                העדפות עיצוב
              </h2>
              <p className="text-sm text-gray-500">
                בחרו פלאייר קיים או הגדירו סגנון ליצירה אוטומטית.
              </p>
            </div>

            <div className="space-y-6">
              <LogoPicker
                selectedLogos={courseData.branding.logos || []}
                onSelect={updateLogos}
              />

              <DesignGuidePanel
                prefs={courseData.design_preferences}
                sessionId={courseData.generated_assets.session_id}
                onChange={updateDesignPreferences}
                onSessionId={(sessionId) => {
                  setCourseData((prev) => {
                    const updated = {
                      ...prev,
                      generated_assets: {
                        ...prev.generated_assets,
                        session_id: sessionId,
                      },
                    };
                    saveToStorage(updated);
                    return updated;
                  });
                }}
              />

              <div className="pt-4 space-y-3 border-t border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {courseData.design_preferences.source === "upload" &&
                    courseData.design_preferences.background_mode ===
                      "same_as_flyer"
                      ? "החלת התמונה"
                      : courseData.design_preferences.source === "upload"
                        ? "יצירת רקע"
                        : "יצירת באנר ורקע"}
                  </p>
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={cancelBannerGeneration}
                      className="px-5 h-11 bg-white text-red-600 text-sm font-bold rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      ביטול
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void generateBanner()}
                      className="px-5 h-11 bg-primary text-gray-900 text-sm font-bold rounded-lg shadow-sm shadow-primary/20 hover-nudge"
                    >
                      {courseData.design_preferences.source === "upload" &&
                      courseData.design_preferences.background_mode ===
                        "same_as_flyer"
                        ? "החל תמונה"
                        : "צור עם AI"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {courseData.design_preferences.source === "upload" &&
                  courseData.design_preferences.background_mode ===
                    "same_as_flyer"
                    ? "התמונה שהעלית תשמש כבאנר וכרקע לדף הנחיתה."
                    : "ניצור תמונות לפי פרטי הקורס והעדפות העיצוב שנבחרו."}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={goToNextStep}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 h-12 bg-primary text-gray-900 text-base font-bold rounded-lg shadow-sm shadow-primary/20 hover-nudge disabled:opacity-50"
            >
              <span>{isSaving ? "שומר..." : "הבא: הגדרות דף נחיתה"}</span>
              <span className="material-symbols-outlined rtl:rotate-180">
                arrow_forward
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Preview Section */}
      <div className="w-full lg:w-1/3 lg:sticky lg:top-8">
        <BannerPreview
          bannerUrl={courseData.generated_assets.banner_url}
          backgroundUrl={courseData.generated_assets.background_url}
          isLoading={isGenerating}
          status={bannerStatus}
          progress={bannerProgress}
          startTime={generationStartTime}
          error={bannerError}
          onCancel={cancelBannerGeneration}
        />
      </div>
    </div>
  );
}
