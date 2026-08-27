"use client";

import { useState } from "react";
import { hebrewAuthError } from "@/lib/auth/messages";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startOAuth = (provider: "google" | "azure") => {
    window.location.href = `/auth/oauth?provider=${provider}&intent=login&redirect=${encodeURIComponent(redirectTo)}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) throw signErr;

      // Ensure profile exists / redirect pending (incl. instructor after email confirm)
      const res = await fetch("/api/auth/session-bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "login" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          hebrewAuthError(body.error, "התחברות נכשלה. נסה/י שוב.")
        );
      }
      await supabase.auth.refreshSession();
      if (body.redirect) {
        window.location.href = body.redirect;
        return;
      }
      window.location.href = redirectTo;
    } catch (err) {
      setError(hebrewAuthError(err, "התחברות נכשלה. נסה/י שוב."));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
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
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg text-white font-semibold disabled:opacity-60"
          style={{ background: "var(--brand-accent)" }}
        >
          {loading ? "מתחבר..." : "התחבר"}
        </button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" style={{ borderColor: "var(--brand-border)" }} />
        </div>
        <div className="relative flex justify-center text-xs">
          <span
            className="px-2"
            style={{ background: "var(--brand-surface)", color: "var(--brand-text-muted)" }}
          >
            או
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => startOAuth("google")}
          className="w-full h-11 rounded-lg border text-sm font-medium"
          style={{ borderColor: "var(--brand-border)" }}
        >
          המשך עם Google
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => startOAuth("azure")}
          className="w-full h-11 rounded-lg border text-sm font-medium"
          style={{ borderColor: "var(--brand-border)" }}
        >
          המשך עם Microsoft
        </button>
      </div>
    </div>
  );
}
