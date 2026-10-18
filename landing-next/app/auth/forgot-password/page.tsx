"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "השליחה נכשלה");
      }
      setDone(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "השליחה נכשלה");
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--brand-bg, #f8fafc)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{
          background: "var(--brand-surface, #fff)",
          borderColor: "var(--brand-border, #e2e8f0)",
        }}
      >
        <h1 className="text-xl font-bold mb-4" style={{ color: "var(--brand-text)" }}>
          איפוס סיסמה
        </h1>
        {done ? (
          <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
            אם קיים חשבון עם המייל הזה, נשלח קישור להגדרת סיסמה חדשה. בדקו גם בספאם.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">אימייל</label>
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
              {loading ? "שולח..." : "שליחת קישור"}
            </button>
          </form>
        )}
        <p className="mt-4 text-sm">
          <Link
            href="/auth/login"
            className="underline"
            style={{ color: "var(--brand-accent)" }}
          >
            חזרה להתחברות
          </Link>
        </p>
      </div>
    </main>
  );
}
