"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { LandingPageData } from "@/types/landing";

interface RegistrationFormProps {
  landingId: string;
  form: LandingPageData["form"];
}

const DEFAULT_REFERRAL_OPTIONS = [
  "חבר/ה המליץ",
  "פייסבוק",
  "אינסטגרם",
  "גוגל",
  "לינקדאין",
  "אחר",
];

export function RegistrationForm({ landingId, form }: RegistrationFormProps) {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle");
  const [referral, setReferral] = useState("");
  const [showOtherField, setShowOtherField] = useState(false);

  // Use form.referralOptions if available, otherwise use defaults
  const referralOptions = form.referralOptions?.length > 0
    ? form.referralOptions
    : DEFAULT_REFERRAL_OPTIONS;

  const handleReferralChange = (value: string) => {
    setReferral(value);
    setShowOtherField(value === "אחר");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState("submitting");

    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData.entries());

    // Map field names to match Apps Script expected format
    const data = {
      landingId,
      fullName: rawData.full_name,
      phone: rawData.phone,
      email: rawData.email || "",
      referral: rawData.referral_other || rawData.referral,
      notes: rawData.interview_availability || "",
    };

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setFormState("success");
      } else {
        throw new Error(result.error || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      alert("שגיאה בשליחת ההרשמה. נסה שוב.");
      setFormState("idle");
    }
  };

  if (formState === "success") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="check_circle" className="text-green-600 text-3xl" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">ההרשמה התקבלה!</h3>
        <p className="text-gray-600">נחזור אליך בהקדם עם פרטים נוספים.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="course_id" value={landingId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          שם מלא <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="full_name"
          required
          className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="ישראל ישראלי"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          טלפון <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          name="phone"
          required
          className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="050-1234567"
          dir="ltr"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          אימייל{" "}
          <span className="text-gray-400 font-normal">(אופציונלי)</span>
        </label>
        <input
          type="email"
          name="email"
          className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="email@example.com"
          dir="ltr"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          איך הגעת אלינו? <span className="text-red-500">*</span>
        </label>
        <select
          name="referral"
          required
          value={referral}
          onChange={(e) => handleReferralChange(e.target.value)}
          className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none bg-white"
        >
          <option value="">בחר אפשרות...</option>
          {referralOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {showOtherField && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ספר/י לנו איך הגעת <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="referral_other"
            required
            className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            placeholder="למשל: ראיתי פוסט בלינקדאין..."
          />
        </div>
      )}

      {form.requiresInterview && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            זמינות לראיון קבלה <span className="text-red-500">*</span>
          </label>
          <textarea
            name="interview_availability"
            required
            rows={3}
            className="w-full p-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
            placeholder="באילו ימים ושעות נוח לך לקיים ראיון?"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={formState === "submitting"}
        className="w-full h-14 bg-primary hover:opacity-90 text-gray-900 text-lg font-bold rounded-xl shadow-lg shadow-primary/30 transition-all transform active:scale-[0.98] mt-6 disabled:opacity-70"
      >
        {formState === "submitting" ? "שולח..." : "שלח הרשמה"}
      </button>

      <p className="text-xs text-gray-400 text-center mt-4">
        בלחיצה על &quot;שלח הרשמה&quot; אני מאשר/ת קבלת עדכונים בנוגע לקורס
      </p>
    </form>
  );
}
