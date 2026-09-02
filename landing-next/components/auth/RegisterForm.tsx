"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PasswordRequirements,
  usePasswordField,
} from "@/components/auth/PasswordRequirements";
import { hebrewAuthError } from "@/lib/auth/messages";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const { password, setPassword, validation } = usePasswordField();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const startOAuth = (provider: "google" | "azure") => {
    window.location.href = `/auth/oauth?provider=${provider}&intent=instructor&redirect=${encodeURIComponent(redirectTo)}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validation.ok) {
      setError("הסיסמה לא עומדת בדרישות");
      return;
    }
    const phoneNorm = normalizeIsraeliPhone(phone);
    if (!phoneNorm) {
      setError("נדרש מספר נייד ישראלי תקין (למשל 05XXXXXXXX)");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const origin = window.location.origin;
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim(),
            display_name: displayName.trim(),
            signup_intent: "instructor",
            phone: phoneNorm,
          },
          emailRedirectTo: `${origin}/auth/callback?intent=instructor_signup&redirect=${encodeURIComponent("/auth/pending")}`,
        },
      });
      if (signErr) throw signErr;
      if (!data.user) throw new Error("ההרשמה נכשלה. נסה/י שוב.");

      // Identities empty → Supabase often returns a fake success for existing email
      if (
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        throw new Error(
          "כבר קיים חשבון עם המייל הזה. התחבר/י או השתמש/י באיפוס סיסמה."
        );
      }

      if (!data.session) {
        // Confirm email enabled — profile is created after confirm / first login
        setAwaitingEmail(true);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/session-bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "instructor_signup",
          displayName: displayName.trim(),
          phone: phoneNorm,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          hebrewAuthError(body.error, "יצירת פרופיל המדריך נכשלה. נסה/י שוב.")
        );
      }
      await supabase.auth.refreshSession();
      window.location.href = body.redirect || "/auth/pending";
    } catch (err) {
      setError(hebrewAuthError(err, "ההרשמה נכשלה. נסה/י שוב."));
      setLoading(false);
    }
  };

  if (awaitingEmail) {
    return (
      <div className="space-y-4 text-center">
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--brand-text)" }}
        >
          נשלח מייל לאימות
        </h2>
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          שלחנו קישור אימות אל{" "}
          <span className="font-medium" dir="ltr">
            {email.trim()}
          </span>
          . לחץ/י על הקישור במייל (גם בספאם), ואז תועבר/י להמתנה לאישור מנהל.
        </p>
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אחרי אימות המייל אפשר גם{" "}
          <Link
            href={`/auth/login?redirect=${encodeURIComponent("/auth/pending")}`}
            className="font-medium underline"
            style={{ color: "var(--brand-accent)" }}
          >
            להתחבר כאן
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">שם משתמש (לתצוגה)</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border"
            style={{ borderColor: "var(--brand-border)" }}
            autoComplete="nickname"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">אימייל</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border"
            style={{ borderColor: "var(--brand-border)" }}
            dir="ltr"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">נייד (לאימות ב-SMS)</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border"
            style={{ borderColor: "var(--brand-border)" }}
            dir="ltr"
            autoComplete="tel"
            placeholder="05XXXXXXXX"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">סיסמה</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border"
            style={{ borderColor: "var(--brand-border)" }}
            dir="ltr"
            autoComplete="new-password"
          />
          <PasswordRequirements password={password} />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !validation.ok}
          className="w-full h-11 rounded-lg text-white font-semibold disabled:opacity-60"
          style={{ background: "var(--brand-accent)" }}
        >
          {loading ? "נרשם..." : "הרשמה כמדריך"}
        </button>
      </form>

      <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
        ייתכן שיישלח מייל לאימות הכתובת. לאחר מכן תמתין/י לאישור מנהל. אחרי האישור
        תידרש כניסה עם סיסמה וקוד SMS לנייד — בלי אפליקציית אימות.
      </p>

      <div className="grid gap-2 pt-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => startOAuth("azure")}
          className="w-full h-11 rounded-lg border text-sm font-medium"
          style={{ borderColor: "var(--brand-border)" }}
        >
          הרשמת מדריך עם Microsoft (אגף)
        </button>
        <p className="text-xs text-center" style={{ color: "var(--brand-text-muted)" }}>
          Google אינו פותח הרשמת מדריך חדשה — רק קישור לחשבון קיים או התחברות.
        </p>
      </div>
    </div>
  );
}
