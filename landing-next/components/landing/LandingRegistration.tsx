"use client";

import { useEffect, useId, useState } from "react";
import { RegistrationForm } from "./RegistrationForm";
import type { LandingPageData } from "@/types/landing";

interface LandingRegistrationProps {
  landingId: string;
  form: LandingPageData["form"];
}

export function LandingRegistration({ landingId, form }: LandingRegistrationProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const formBlock = (
    <>
      <RegistrationForm landingId={landingId} form={form} />
      {form.paymentLink && (
        <a
          href={form.paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center w-full min-h-12 rounded-xl border-2 border-gray-900 text-gray-900 font-bold hover-nudge cursor-pointer"
        >
          לתשלום
        </a>
      )}
    </>
  );

  return (
    <div className="lg:col-span-1">
      <div className="hidden lg:block">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm sticky top-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">הרשמה לקורס</h2>
          <p className="text-sm text-gray-500 mb-6">מלא את הפרטים ונחזור אליך בהקדם</p>
          {formBlock}
        </div>
      </div>

      {!open && (
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.96)",
            borderColor: "var(--brand-border)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto w-full min-h-12 rounded-xl text-base font-bold leading-none inline-flex items-center justify-center hover-nudge"
            style={{
              background: "var(--primary)",
              color: "var(--primary-contrast)",
            }}
          >
            להרשמה
          </button>
        </div>
      )}

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--brand-page-bg, #fafafa)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{
              background: "var(--brand-surface, #fff)",
              borderColor: "var(--brand-border, #cbd5e1)",
            }}
          >
            <h2 id={titleId} className="text-xl font-bold text-gray-900">
              הרשמה לקורס
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-12 min-w-12 inline-flex items-center justify-center rounded-md text-sm font-semibold"
              style={{ color: "var(--brand-text)" }}
            >
              סגור
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <p className="text-base text-gray-500 mb-6">מלא את הפרטים ונחזור אליך בהקדם</p>
            {formBlock}
          </div>
        </div>
      )}
    </div>
  );
}
