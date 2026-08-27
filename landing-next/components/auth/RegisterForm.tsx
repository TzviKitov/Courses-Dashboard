"use client";

import { useState } from "react";
import {
  PasswordRequirements,
  usePasswordField,
} from "@/components/auth/PasswordRequirements";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const { password, setPassword, validation } = usePasswordField();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: displayName.trim(), display_name: displayName.trim() },
        },
      });
      if (signErr) throw signErr;
      if (!data.user) throw new Error("ההרשמה נכשלה");

      const res = await fetch("/api/auth/session-bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "instructor_signup",
          displayName: displayName.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "שגיאה ביצירת פרופיל");
      await supabase.auth.refreshSession();
      window.location.href = body.redirect || "/auth/pending";
    } catch (err) {
      setError(err instanceof Error ? err.message : "הרשמה נכשלה");
      setLoading(false);
    }
  };

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
        לאחר ההרשמה תמתין לאישור מנהל לפני יצירת קורסים.
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
