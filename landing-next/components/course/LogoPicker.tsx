"use client";

import { useState, useEffect } from "react";
import type { Logo } from "@/types/course";

const MAX_LOGOS = 4;

interface LogoPickerProps {
  selectedLogos: Logo[];
  onSelect: (logos: Logo[]) => void;
}

export function LogoPicker({ selectedLogos, onSelect }: LogoPickerProps) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load logos from API
  useEffect(() => {
    if (isModalOpen && logos.length === 0) {
      setIsLoading(true);
      fetch("/api/logos")
        .then((res) => res.json())
        .then((data) => {
          setLogos(data);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load logos:", err);
          setIsLoading(false);
        });
    }
  }, [isModalOpen, logos.length]);

  const filteredLogos = searchQuery
    ? logos.filter((logo) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          logo.name.toLowerCase().includes(searchLower) ||
          logo.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      })
    : logos;

  const isSelected = (logo: Logo) =>
    selectedLogos.some((l) => l.id === logo.id);

  const handleToggle = (logo: Logo) => {
    if (isSelected(logo)) {
      // Remove logo
      onSelect(selectedLogos.filter((l) => l.id !== logo.id));
    } else if (selectedLogos.length < MAX_LOGOS) {
      // Add logo
      onSelect([...selectedLogos, logo]);
    }
  };

  const handleRemove = (logoId: string) => {
    onSelect(selectedLogos.filter((l) => l.id !== logoId));
  };

  return (
    <>
      {/* Logo Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            לוגואים ({selectedLogos.length}/{MAX_LOGOS})
          </span>
          <button
            type="button"
            className="text-sm font-bold text-primary hover-wiggle"
            onClick={() => setIsModalOpen(true)}
          >
            בחר לוגואים מספרייה
          </button>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          {selectedLogos.length === 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-16 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400">לא נבחר</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">ללא לוגואים</p>
                <p className="text-xs text-gray-500">
                  ניתן לבחור עד 3 לוגואים לשילוב בבאנר
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                הלוגואים ישולבו בבאנר לפי הסדר: ראשי, משני, שלישי
              </p>
              <div className="flex flex-wrap gap-3">
                {selectedLogos.map((logo, index) => (
                  <div
                    key={logo.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <span className="text-xs font-bold text-gray-400 w-4">
                      {index + 1}
                    </span>
                    <div className="w-12 h-8 rounded bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={logo.url}
                        alt={logo.name}
                        className="max-h-8"
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 max-w-24 truncate">
                      {logo.name}
                    </span>
                    <button
                      type="button"
                      className="text-gray-400 hover-wiggle"
                      onClick={() => handleRemove(logo.id)}
                    >
                      <span className="material-symbols-outlined text-lg">
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999]">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative max-w-3xl mx-auto mt-16 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  בחר לוגואים ({selectedLogos.length}/{MAX_LOGOS})
                </h3>
                <p className="text-sm text-gray-500">
                  לחץ לבחירה/ביטול. ניתן לבחור עד {MAX_LOGOS} לוגואים.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover-wiggle"
                onClick={() => setIsModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5">
              <input
                type="text"
                placeholder="חיפוש לוגו..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
              />

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredLogos.length === 0 ? (
                <p className="text-sm text-gray-400 py-12 text-center">
                  לא נמצאו לוגואים.
                </p>
              ) : (
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                  {filteredLogos.map((logo) => {
                    const selected = isSelected(logo);
                    const disabled = !selected && selectedLogos.length >= MAX_LOGOS;
                    return (
                      <button
                        key={logo.id}
                        type="button"
                        disabled={disabled}
                        className={`text-right p-3 rounded-xl border-2 flex flex-col gap-3 ${
                          selected
                            ? "border-primary bg-primary/5"
                            : disabled
                            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                            : "border-gray-200 bg-white hover-nudge"
                        }`}
                        onClick={() => handleToggle(logo)}
                      >
                        <div className="w-full h-14 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden relative">
                          <img
                            src={logo.url}
                            alt={logo.name}
                            className="max-h-14"
                          />
                          {selected && (
                            <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <span className="material-symbols-outlined text-white text-sm">
                                check
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {logo.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {logo.tags?.slice(0, 3).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                className="px-6 h-11 bg-primary text-gray-900 font-bold rounded-lg hover-nudge"
                onClick={() => setIsModalOpen(false)}
              >
                סיום ({selectedLogos.length} נבחרו)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
