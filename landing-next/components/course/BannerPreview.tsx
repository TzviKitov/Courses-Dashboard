"use client";

import { useState, useEffect } from "react";

interface BannerPreviewProps {
  bannerUrl?: string;
  backgroundUrl?: string;
  isLoading?: boolean;
  status?: string;
  progress?: number;
  startTime?: number | null;
  error?: string;
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formatted = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, "0")}`
    : `${seconds} שניות`;

  return (
    <span className="text-xs text-gray-400 tabular-nums">{formatted}</span>
  );
}

const STEPS = [
  { key: "logos", label: "טעינת לוגואים", minProgress: 0 },
  { key: "banner", label: "יצירת באנר", minProgress: 15 },
  { key: "background", label: "יצירת תמונת רקע", minProgress: 55 },
  { key: "colors", label: "חילוץ צבעים", minProgress: 92 },
] as const;

export function BannerPreview({
  bannerUrl,
  backgroundUrl,
  isLoading,
  status,
  progress = 0,
  startTime,
  error,
}: BannerPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Banner Preview */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">באנר הקורס</h3>
        <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 px-6 w-full">
              {/* Spinner */}
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />

              {/* Status message */}
              <p className="text-sm text-gray-600 font-medium text-center">
                {status || "מייצר באנר..."}
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-gray-400">{progress}%</span>
                  {startTime && <ElapsedTimer startTime={startTime} />}
                </div>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-1.5 mt-1">
                {STEPS.map((step) => {
                  const isActive = progress >= step.minProgress && progress < (STEPS[STEPS.indexOf(step) + 1]?.minProgress ?? 100);
                  const isDone = progress >= (STEPS[STEPS.indexOf(step) + 1]?.minProgress ?? 100);
                  return (
                    <div key={step.key} className="flex items-center gap-1.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          isDone
                            ? "bg-green-500"
                            : isActive
                              ? "bg-primary animate-pulse"
                              : "bg-gray-300"
                        }`}
                        title={step.label}
                      />
                      {STEPS.indexOf(step) < STEPS.length - 1 && (
                        <div
                          className={`w-4 h-0.5 transition-all duration-300 ${
                            isDone ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : bannerUrl ? (
            <img
              src={bannerUrl}
              alt="Banner Preview"
              className="w-full h-full object-cover"
            />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">לא נוצר באנר עדיין</p>
          )}
        </div>
      </div>

      {/* Background Preview */}
      {(backgroundUrl || bannerUrl) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">תמונת רקע לדף נחיתה</h3>
          <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
            <img
              src={backgroundUrl || bannerUrl}
              alt="Background Preview"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            תמונה זו תשמש כרקע ה-Hero בדף הנחיתה
          </p>
        </div>
      )}
    </div>
  );
}
