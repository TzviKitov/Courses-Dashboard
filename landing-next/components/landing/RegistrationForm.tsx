"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  PasswordRequirements,
  usePasswordField,
} from "@/components/auth/PasswordRequirements";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
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

type AuthMode = "sms" | "email" | "oauth";

export function RegistrationForm({ landingId, form }: RegistrationFormProps) {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">(
    "idle"
  );
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [referral, setReferral] = useState("");
  const [referralOther, setReferralOther] = useState("");
  const [interviewAvailability, setInterviewAvailability] = useState("");
  const [showOtherField, setShowOtherField] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [authed, setAuthed] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sms");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const { password, setPassword, validation } = usePasswordField();
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getUser();
        setAuthed(Boolean(data.user));
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  const referralOptions =
    form.referralOptions?.length > 0
      ? form.referralOptions
      : DEFAULT_REFERRAL_OPTIONS;

  const handleReferralChange = (value: string) => {
    setReferral(value);
    setShowOtherField(value === "אחר");
    if (value !== "אחר") setReferralOther("");
  };

  const isMissing = (value: string) => showValidation && !value.trim();

  const sendSmsOtp = async () => {
    setAuthError(null);
    const normalized = normalizeIsraeliPhone(phone);
    if (!normalized) {
      setAuthError("יש להזין מספר נייד ישראלי תקין (05X)");
      return;
    }
    setAuthBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      setOtpSent(true);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "שליחת קוד נכשלה");
    } finally {
      setAuthBusy(false);
    }
  };

  const verifySmsOtp = async () => {
    setAuthError(null);
    const normalized = normalizeIsraeliPhone(phone);
    if (!normalized || !otp.trim()) {
      setAuthError("חסר קוד או מספר");
      return;
    }
    setAuthBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: otp.trim(),
        type: "sms",
      });
      if (error) throw error;
      await fetch("/api/auth/session-bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "student",
          displayName: fullName.trim(),
          phone: normalized,
        }),
      });
      setAuthed(true);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "אימות נכשל");
    } finally {
      setAuthBusy(false);
    }
  };

  const emailSignUpOrIn = async () => {
    setAuthError(null);
    if (!email.trim()) {
      setAuthError("נדרש אימייל");
      return;
    }
    if (!validation.ok) {
      setAuthError("הסיסמה לא עומדת בדרישות");
      return;
    }
    setAuthBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (upErr) {
        const { error: inErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (inErr) throw inErr;
      }
      await fetch("/api/auth/session-bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "student",
          displayName: fullName.trim(),
        }),
      });
      setAuthed(true);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "אימות נכשל");
    } finally {
      setAuthBusy(false);
    }
  };

  const startOAuth = (provider: "google" | "azure") => {
    const redirect = `/l/${landingId}#register`;
    window.location.href = `/auth/oauth?provider=${provider}&intent=student&redirect=${encodeURIComponent(redirect)}`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowValidation(true);

    const otherRequired = showOtherField && !referralOther.trim();
    const interviewRequired =
      form.requiresInterview && !interviewAvailability.trim();

    if (
      !fullName.trim() ||
      !phone.trim() ||
      !referral.trim() ||
      otherRequired ||
      interviewRequired
    ) {
      alert("חסרים שדות חובה (מוקפים באדום)");
      return;
    }

    if (!authed) {
      alert("יש להשלים אימות (SMS / Google / Microsoft / מייל) לפני השליחה");
      return;
    }

    setFormState("submitting");

    const data = {
      landingId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      referral: showOtherField ? referralOther.trim() : referral,
      notes: interviewAvailability.trim(),
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
      alert(
        error instanceof Error
          ? error.message
          : "שגיאה בשליחת ההרשמה. נסה שוב."
      );
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

  const inputClass = (invalid: boolean, extra = "") =>
    [
      "w-full rounded-lg border focus:ring-2 focus:border-transparent outline-none transition-all",
      invalid
        ? "border-red-500 focus:ring-red-400 field-invalid"
        : "border-gray-300 focus:ring-primary",
      extra,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate id="register">
      <input type="hidden" name="course_id" value={landingId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          שם מלא <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className={inputClass(isMissing(fullName), "h-12 px-4")}
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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className={inputClass(isMissing(phone), "h-12 px-4")}
          placeholder="050-1234567"
          dir="ltr"
        />
      </div>

      {/* Auth block */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50">
        <p className="text-sm font-semibold text-gray-800">
          אימות חשבון {authed ? "✓ מחובר" : "(חובה להרשמה)"}
        </p>
        {!authed && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  ["sms", "SMS"],
                  ["oauth", "Google / Microsoft"],
                  ["email", "מייל וסיסמה"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAuthMode(mode)}
                  className={`px-3 py-1.5 rounded-full border ${
                    authMode === mode
                      ? "bg-primary/20 border-primary"
                      : "bg-white border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {authMode === "sms" && (
              <div className="space-y-2">
                {!otpSent ? (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void sendSmsOtp()}
                    className="w-full h-10 rounded-lg bg-white border border-gray-300 text-sm font-medium"
                  >
                    שלח קוד ב-SMS
                  </button>
                ) : (
                  <>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="קוד בן 6 ספרות"
                      className="w-full h-10 px-3 rounded-lg border border-gray-300"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void verifySmsOtp()}
                      className="w-full h-10 rounded-lg bg-primary text-gray-900 text-sm font-bold"
                    >
                      אמת קוד
                    </button>
                  </>
                )}
              </div>
            )}

            {authMode === "oauth" && (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => startOAuth("google")}
                  className="h-10 rounded-lg bg-white border border-gray-300 text-sm"
                >
                  המשך עם Google
                </button>
                <button
                  type="button"
                  onClick={() => startOAuth("azure")}
                  className="h-10 rounded-lg bg-white border border-gray-300 text-sm"
                >
                  המשך עם Microsoft
                </button>
              </div>
            )}

            {authMode === "email" && (
              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300"
                  dir="ltr"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="סיסמה"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300"
                  dir="ltr"
                />
                <PasswordRequirements password={password} />
                <button
                  type="button"
                  disabled={authBusy || !validation.ok}
                  onClick={() => void emailSignUpOrIn()}
                  className="w-full h-10 rounded-lg bg-primary text-gray-900 text-sm font-bold disabled:opacity-60"
                >
                  התחבר / הירשם
                </button>
              </div>
            )}

            {authError && (
              <p className="text-xs text-red-600" role="alert">
                {authError}
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          אימייל{" "}
          <span className="text-gray-400 font-normal">(אופציונלי)</span>
        </label>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          className={inputClass(isMissing(referral), "h-12 px-4 bg-white")}
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
            value={referralOther}
            onChange={(e) => setReferralOther(e.target.value)}
            required
            className={inputClass(isMissing(referralOther), "h-12 px-4")}
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
            value={interviewAvailability}
            onChange={(e) => setInterviewAvailability(e.target.value)}
            required
            rows={3}
            className={inputClass(
              isMissing(interviewAvailability),
              "p-4 resize-none"
            )}
            placeholder="באילו ימים ושעות נוח לך לקיים ראיון?"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={formState === "submitting" || !authed}
        className="w-full h-14 bg-primary text-gray-900 text-lg font-bold rounded-xl shadow-lg shadow-primary/30 hover-nudge mt-6 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
      >
        {formState === "submitting" ? "שולח..." : "שלח הרשמה"}
      </button>

      <p className="text-xs text-gray-400 text-center mt-4">
        בלחיצה על &quot;שלח הרשמה&quot; אני מאשר/ת קבלת עדכונים בנוגע לקורס
      </p>
    </form>
  );
}
