"use client";

import { useState, useEffect, useCallback } from "react";
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
  normalizeSchedule,
  SECTOR_OPTIONS,
} from "@/types/course";
import { LogoPicker } from "./LogoPicker";
import { BannerPreview } from "./BannerPreview";

const STORAGE_KEY = "courseData";
const STORAGE_VERSION_KEY = "courseDataVersion";
// Bump this when the on-disk shape changes incompatibly so old clients reset.
// v2: switched from base64/blob asset URLs to Supabase Storage URLs.
// v3: structured schedule dates + program contact / classification fields.
const CURRENT_STORAGE_VERSION = "3";

function hydrateCourseData(parsed: Partial<CourseData>): CourseData {
  const merged = { ...defaultCourseData, ...parsed };
  const details = {
    ...defaultCourseData.course_details,
    ...parsed.course_details,
    schedule: normalizeSchedule(parsed.course_details?.schedule),
  };
  return {
    ...merged,
    course_details: details,
    design_preferences: {
      ...defaultCourseData.design_preferences,
      ...parsed.design_preferences,
    },
    branding: {
      ...defaultCourseData.branding,
      ...parsed.branding,
      theme: {
        ...defaultCourseData.branding.theme,
        ...parsed.branding?.theme,
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

  const updateDesignPreferences = (
    field: keyof CourseData["design_preferences"],
    value: string
  ) => {
    setCourseData((prev) => {
      const updated = {
        ...prev,
        design_preferences: { ...prev.design_preferences, [field]: value },
        // Clear cached banner when design preferences change
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
    const d = courseData.course_details;
    const fields = [
      { value: d.title, label: "שם ההכשרה/התוכנית" },
      { value: d.description, label: "תיאור הקורס" },
      { value: d.audience_category || d.target_audience, label: "קהל יעד" },
      { value: d.schedule.start_date, label: "תאריך פתיחה" },
      { value: d.instructor_name, label: "שם המדריך" },
      { value: d.organization, label: "ארגון" },
      { value: d.role, label: "תפקיד" },
      { value: d.contact_phone, label: "טלפון ליצירת קשר" },
      { value: d.course_type, label: "סוג קורס" },
      { value: d.sector, label: "מגזר" },
      { value: d.gender_separation, label: "הפרדה מגדרית" },
    ];

    for (const field of fields) {
      if (!field.value.trim()) {
        alert(`${field.label} הוא שדה חובה`);
        return false;
      }
    }
    return true;
  };

  const generateBanner = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setBannerStatus("שולח בקשה ליצירת באנר...");
    setBannerProgress(0);
    setBannerError("");
    setGenerationStartTime(Date.now());

    // Clear old banner before generating new one
    setCourseData((prev) => {
      const updated = {
        ...prev,
        generated_assets: {
          ...prev.generated_assets,
          banner_url: "",
          banner_thumb_url: "",
          background_url: "",
          background_thumb_url: "",
          session_id: undefined,
        },
      };
      saveToStorage(updated);
      return updated;
    });

    try {
      const response = await fetch("/api/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          design: {
            aesthetic_style: courseData.design_preferences.aesthetic_style,
            color_palette: courseData.design_preferences.color_palette,
            lighting_and_atmosphere: courseData.design_preferences.lighting_and_atmosphere,
            visual_style: courseData.design_preferences.visual_style,
            composition_rule: courseData.design_preferences.composition_rule,
            lighting_mood: courseData.design_preferences.lighting_mood,
            color_mood: courseData.design_preferences.color_mood,
          },
          branding: {
            logos: courseData.branding.logos || [],
            colors: {
              primary: courseData.branding.theme.overrides.primary,
              accent: courseData.branding.theme.overrides.accent,
            },
          },
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
      console.error("Banner generation error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      setBannerError(msg);
      setBannerStatus("");
      setBannerProgress(0);
    } finally {
      setIsGenerating(false);
      setGenerationStartTime(null);
    }
  };

  const goToNextStep = () => {
    if (!validateForm()) return;

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
                  className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
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
                  className="w-full p-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-400"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
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
                  className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
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
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
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
                        className={`w-12 h-12 rounded-lg border-2 font-semibold transition-all ${
                          isSelected
                            ? "bg-primary border-primary text-gray-900"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
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
                הגדר את הסגנון הוויזואלי הרצוי לחומרי השיווק של הקורס.
              </p>
            </div>

            <div className="space-y-6">
              {/* Logo Picker */}
              <LogoPicker
                selectedLogos={courseData.branding.logos || []}
                onSelect={updateLogos}
              />

              {/* Design Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    סגנון אסתטי
                  </span>
                  <select
                    value={courseData.design_preferences.aesthetic_style}
                    onChange={(e) =>
                      updateDesignPreferences("aesthetic_style", e.target.value)
                    }
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                  >
                    <option value="minimalist">מינימליסטי ונקי</option>
                    <option value="modern_tech">הייטקי ומודרני</option>
                    <option value="luxury">יוקרתי ואלגנטי</option>
                    <option value="retro">רטרו / וינטג&apos;</option>
                    <option value="playful">שמח וצבעוני</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    פלטת צבעים
                  </span>
                  <select
                    value={courseData.design_preferences.color_palette}
                    onChange={(e) =>
                      updateDesignPreferences("color_palette", e.target.value)
                    }
                    className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                  >
                    <option value="brand_colors">בהתאם למותג</option>
                    <option value="light_airy">בהיר ואוורירי</option>
                    <option value="dark_mode">כהה ודרמטי</option>
                    <option value="pastel">צבעי פסטל</option>
                    <option value="vibrant">נועז ורווי</option>
                  </select>
                </label>
              </div>

              {/* Art Direction - Advanced Design Options */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-900 mb-4">
                  הגדרות מתקדמות לבאנר
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      סגנון ויזואלי
                    </span>
                    <select
                      value={courseData.design_preferences.visual_style}
                      onChange={(e) =>
                        updateDesignPreferences("visual_style", e.target.value)
                      }
                      className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="photorealistic">ריאליסטי / צילומי</option>
                      <option value="three_d_render">תלת-ממד</option>
                      <option value="vector_flat">וקטור נקי / שטוח</option>
                      <option value="abstract_tech">מופשט / טכנולוגי</option>
                      <option value="hand_drawn">איור ידני</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      קומפוזיציה
                    </span>
                    <select
                      value={courseData.design_preferences.composition_rule}
                      onChange={(e) =>
                        updateDesignPreferences("composition_rule", e.target.value)
                      }
                      className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="text_center">טקסט במרכז</option>
                      <option value="text_side_negative_space">טקסט בצד (מרחב נקי)</option>
                      <option value="knolling">סידור שטוח (Knolling)</option>
                      <option value="rule_of_thirds">חוק השלישים</option>
                      <option value="bento_grid">רשת מחולקת (Bento)</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      תאורה ואווירה
                    </span>
                    <select
                      value={courseData.design_preferences.lighting_mood}
                      onChange={(e) =>
                        updateDesignPreferences("lighting_mood", e.target.value)
                      }
                      className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="golden_hour">שעת הזהב (חמים)</option>
                      <option value="soft_studio">סטודיו מקצועי</option>
                      <option value="neon_cyberpunk">ניאון / סייברפאנק</option>
                      <option value="rembrandt">דרמטי אמנותי</option>
                      <option value="natural_bright">טבעי ובהיר</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      אווירת צבעים
                    </span>
                    <select
                      value={courseData.design_preferences.color_mood}
                      onChange={(e) =>
                        updateDesignPreferences("color_mood", e.target.value)
                      }
                      className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="corporate">עסקי (כחול/לבן)</option>
                      <option value="creative_vibrant">יצירתי (צבעוני)</option>
                      <option value="luxury_dark">יוקרתי (שחור/זהב)</option>
                      <option value="pastel_soft">רך (פסטל)</option>
                      <option value="monochromatic">מונוכרומטי</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Banner Generation */}
              <div className="pt-4 space-y-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    יצירת באנר
                  </p>
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={generateBanner}
                    className="px-5 h-11 bg-primary hover:opacity-90 text-gray-900 text-sm font-bold rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
                  >
                    {isGenerating ? "מייצר..." : "Generate Banner"}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  ניצור באנר אוטומטי לפי פרטי הקורס והעדפות העיצוב.
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 h-12 bg-primary hover:opacity-90 text-gray-900 text-base font-bold rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
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
        />
      </div>
    </div>
  );
}
