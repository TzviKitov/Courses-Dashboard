"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignPreferences } from "@/types/course";
import {
  COLOR_PALETTES,
  COMPOSITIONS,
  VISUAL_STYLES,
  selectComposition,
  toggleVisualStyle,
  type CompositionId,
  type VisualStyleId,
} from "@/constants/design-guide";
import {
  HEBREW_FONTS,
  buildAllGoogleFontUrls,
  type HebrewFont,
} from "@/constants/fonts";
import { WhenToChoose } from "./WhenToChoose";

interface DesignGuidePanelProps {
  prefs: DesignPreferences;
  sessionId?: string;
  onChange: (next: DesignPreferences) => void;
  onSessionId?: (sessionId: string) => void;
  /** When false, hide flyer-source branch (already chosen elsewhere). */
  showSourceBranch?: boolean;
}

async function uploadDesignImage(
  file: File,
  kind: "flyer" | "inspiration",
  sessionId?: string
): Promise<{ url: string; thumbUrl: string; sessionId: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  if (sessionId) form.append("sessionId", sessionId);

  const res = await fetch("/api/upload-design-image", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Upload failed");
  return {
    url: data.url,
    thumbUrl: data.thumbUrl,
    sessionId: data.sessionId,
  };
}

function FontOption({
  font,
  selected,
  onSelect,
}: {
  font: HebrewFont;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`rounded-xl border p-3 text-right hover-nudge cursor-pointer ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
          : "border-gray-200"
      }`}
    >
      <span
        className="block text-base font-semibold text-gray-900"
        style={{ fontFamily: font.previewFamily }}
      >
        {font.displayName} ({font.labelHe})
      </span>
      <span
        className="mt-1 block text-sm text-gray-500"
        style={{ fontFamily: font.previewFamily }}
      >
        אבגדה ABC 123 — דוגמה לעיצוב
      </span>
      {font.status === "substitute" && (
        <span className="mt-1 inline-block text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
          תצוגה זמנית (תחליף)
        </span>
      )}
      <WhenToChoose text={font.whenToChoose} />
    </div>
  );
}

export function DesignGuidePanel({
  prefs,
  sessionId,
  onChange,
  onSessionId,
  showSourceBranch = true,
}: DesignGuidePanelProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const flyerInputRef = useRef<HTMLInputElement>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    for (const url of buildAllGoogleFontUrls()) {
      if (document.querySelector(`link[href="${url}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
  }, []);

  const patch = (partial: Partial<DesignPreferences>) => {
    onChange({ ...prefs, ...partial });
  };

  const showWizard =
    prefs.source === "generate" ||
    (prefs.source === "upload" && prefs.background_mode === "generate");

  const handleFlyerUpload = async (file: File | null) => {
    if (!file) return;
    setUploadError("");
    setUploading("flyer");
    try {
      const result = await uploadDesignImage(file, "flyer", sessionId);
      onSessionId?.(result.sessionId);
      patch({
        source: "upload",
        uploaded_flyer_url: result.url,
        uploaded_flyer_thumb_url: result.thumbUrl,
        background_mode: prefs.background_mode || "same_as_flyer",
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "שגיאה בהעלאה");
    } finally {
      setUploading(null);
    }
  };

  const handleInspirationUpload = async (file: File | null) => {
    if (!file) return;
    setUploadError("");
    setUploading("inspiration");
    try {
      const result = await uploadDesignImage(file, "inspiration", sessionId);
      onSessionId?.(result.sessionId);
      patch({
        background_prompt: {
          mode: "inspiration",
          text: prefs.background_prompt?.text || "",
          inspiration_url: result.url,
        },
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "שגיאה בהעלאה");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-8">
      {showSourceBranch && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">איך ניצור את הפלאייר?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                patch({
                  source: "upload",
                  background_mode: "same_as_flyer",
                })
              }
              className={`rounded-xl border p-4 text-right hover-nudge ${
                prefs.source === "upload"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-gray-200"
              }`}
            >
              <span className="block font-semibold text-gray-900">
                יש לי פלאייר / תמונה משלי
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                העלאת קובץ מוכן — בלי יצירת באנר ב-AI
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                patch({
                  source: "generate",
                  background_mode: "generate",
                })
              }
              className={`rounded-xl border p-4 text-right hover-nudge ${
                prefs.source === "generate"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-gray-200"
              }`}
            >
              <span className="block font-semibold text-gray-900">
                המשך ליצירת פלאייר
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                בחירת סגנון ויצירה אוטומטית עם Gemini
              </span>
            </button>
          </div>
        </section>
      )}

      {prefs.source === "upload" && (
        <section className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={uploading === "flyer"}
              onClick={() => flyerInputRef.current?.click()}
              className="px-4 h-10 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 hover-nudge disabled:opacity-50"
            >
              {uploading === "flyer" ? "מעלה..." : "העלאת פלאייר / תמונה"}
            </button>
            <input
              ref={flyerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleFlyerUpload(e.target.files?.[0] || null)}
            />
            {prefs.uploaded_flyer_url && (
              <img
                src={prefs.uploaded_flyer_thumb_url || prefs.uploaded_flyer_url}
                alt="פלאייר שהועלה"
                className="h-16 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">רקע לדף הנחיתה</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="bg-mode"
                className="mt-1"
                checked={prefs.background_mode === "same_as_flyer"}
                onChange={() => patch({ background_mode: "same_as_flyer" })}
              />
              <span className="text-sm text-gray-700">
                להשתמש באותה תמונה גם לדף הנחיתה
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="bg-mode"
                className="mt-1"
                checked={prefs.background_mode === "generate"}
                onChange={() => patch({ background_mode: "generate" })}
              />
              <span className="text-sm text-gray-700">
                לעצב רקע ב-AI ולבחור את כל העדפות העיצוב
              </span>
            </label>
          </div>
        </section>
      )}

      {uploadError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</p>
      )}

      {showWizard && (
        <div className="space-y-8 pt-2 border-t border-gray-100">
          {/* 1. Background */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">1. מה ברקע?</h3>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { mode: "free_text" as const, label: "תיאור חופשי" },
                  { mode: "surprise" as const, label: "תפתיע אותי" },
                  { mode: "inspiration" as const, label: "תמונת השראה" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() =>
                    patch({
                      background_prompt: {
                        ...prefs.background_prompt,
                        mode: opt.mode,
                      },
                    })
                  }
                  className={`px-3 h-9 rounded-lg text-xs font-semibold border hover-chip ${
                    prefs.background_prompt?.mode === opt.mode
                      ? "border-primary bg-primary/10 text-gray-900"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {prefs.background_prompt?.mode === "free_text" && (
              <textarea
                value={prefs.background_prompt.text || ""}
                onChange={(e) =>
                  patch({
                    background_prompt: {
                      ...prefs.background_prompt,
                      mode: "free_text",
                      text: e.target.value,
                    },
                  })
                }
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                placeholder="תארו את סגנון תמונת הרקע הרצוי..."
              />
            )}
            {prefs.background_prompt?.mode === "inspiration" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={uploading === "inspiration"}
                  onClick={() => inspirationInputRef.current?.click()}
                  className="px-4 h-10 bg-white border border-gray-200 rounded-lg text-sm font-semibold hover-nudge disabled:opacity-50"
                >
                  {uploading === "inspiration" ? "מעלה..." : "העלאת תמונת השראה"}
                </button>
                <input
                  ref={inspirationInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) =>
                    void handleInspirationUpload(e.target.files?.[0] || null)
                  }
                />
                {prefs.background_prompt.inspiration_url && (
                  <img
                    src={prefs.background_prompt.inspiration_url}
                    alt="השראה"
                    className="h-16 rounded-lg border border-gray-200 object-cover"
                  />
                )}
              </div>
            )}
            {prefs.background_prompt?.mode === "surprise" && (
              <p className="text-xs text-gray-500">
                המערכת תבחר כיוון ויזואלי מפתיע ומתאים לנושא הקורס.
              </p>
            )}
          </section>

          {/* 2. Visual styles */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">2. סגנון עיצובי</h3>
              <p className="text-xs text-gray-500 mt-1">ניתן לבחור יותר מסגנון אחד</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VISUAL_STYLES.map((style) => {
                const selected = prefs.visual_styles?.includes(style.id);
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      const next = toggleVisualStyle(
                        prefs.visual_styles || [],
                        style.id as VisualStyleId
                      );
                      // Keep at least one style selected
                      patch({
                        visual_styles: next.length ? next : [style.id],
                      });
                    }}
                    className={`rounded-xl border px-3 py-3 text-right text-sm font-semibold hover-nudge ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40 text-gray-900"
                        : "border-gray-200 text-gray-700"
                    }`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Fonts */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">3. פונטים</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1.5">
              {HEBREW_FONTS.map((font) => (
                <FontOption
                  key={font.id}
                  font={font}
                  selected={prefs.fonts?.banner_font_id === font.id}
                  onSelect={() =>
                    patch({
                      fonts: {
                        ...prefs.fonts,
                        banner_font_id: font.id,
                        landing_font_id:
                          prefs.fonts?.landing_font_mode === "same"
                            ? font.id
                            : prefs.fonts?.landing_font_id,
                      },
                    })
                  }
                />
              ))}
            </div>
          </section>

          {/* 4. Compositions */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">4. קומפוזיציות</h3>
              <p className="text-xs text-gray-500 mt-1">
                בחרו קומפוזיציה אחת (האפשרויות סותרות זו את זו)
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COMPOSITIONS.map((comp) => {
                const selected = prefs.compositions?.[0] === comp.id;
                return (
                  <div
                    key={comp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      patch({
                        compositions: selectComposition(
                          prefs.compositions || [],
                          comp.id as CompositionId
                        ),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        patch({
                          compositions: selectComposition(
                            prefs.compositions || [],
                            comp.id as CompositionId
                          ),
                        });
                      }
                    }}
                    className={`rounded-xl border p-3 text-right hover-nudge cursor-pointer ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                        : "border-gray-200"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">
                      {comp.label}
                    </span>
                    <WhenToChoose text={comp.whenToChoose} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. Colors */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">5. פלטות צבעים</h3>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { mode: "surprise" as const, label: "תפתיע אותי! (מומלץ)" },
                  { mode: "manual" as const, label: "בחירה ידנית (4 צבעים)" },
                  { mode: "preset" as const, label: "פלטה מוכנה" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => patch({ color_mode: opt.mode })}
                  className={`px-3 h-9 rounded-lg text-xs font-semibold border hover-chip ${
                    prefs.color_mode === opt.mode
                      ? "border-primary bg-primary/10 text-gray-900"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {prefs.color_mode === "manual" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(prefs.manual_colors || ["#007BFF", "#17A2B8", "#E3F2FD", "#212529"]).map(
                  (color, idx) => (
                    <label key={idx} className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-500">צבע {idx + 1}</span>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const next = [
                            ...(prefs.manual_colors || [
                              "#007BFF",
                              "#17A2B8",
                              "#E3F2FD",
                              "#212529",
                            ]),
                          ] as [string, string, string, string];
                          next[idx] = e.target.value;
                          patch({ manual_colors: next });
                        }}
                        className="h-12 w-full rounded-lg border border-gray-200 cursor-pointer bg-white"
                      />
                      <span className="text-[10px] text-gray-400 font-mono">{color}</span>
                    </label>
                  )
                )}
              </div>
            )}

            {prefs.color_mode === "preset" && (
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto p-1.5">
                {COLOR_PALETTES.map((palette) => {
                  const selected = prefs.palette_ids?.[0] === palette.id;
                  return (
                    <div
                      key={palette.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => patch({ palette_ids: [palette.id] })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          patch({ palette_ids: [palette.id] });
                        }
                      }}
                      className={`rounded-xl border p-3 text-right hover-nudge cursor-pointer ${
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                          : "border-gray-200"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-gray-900">
                        {palette.label}
                      </span>
                      <div className="mt-2 flex gap-1.5">
                        {palette.colors.map((c) => (
                          <span
                            key={c}
                            className="h-6 w-6 rounded-full border border-black/10"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                      <WhenToChoose
                        text={`${palette.whenToChoose}. ${palette.description}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
