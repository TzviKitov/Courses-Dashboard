"use client";

import { useState } from "react";
import {
  PasswordRequirements,
  usePasswordField,
} from "@/components/auth/PasswordRequirements";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function SetPasswordPage() {
  const { password, setPassword, validation } = usePasswordField();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validation.ok) {
      setError("הסיסמה לא עומדת בדרישות");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
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
          הגדרת סיסמה
        </h1>
        {done ? (
          <p className="text-sm">
            הסיסמה עודכנה.{" "}
            <a href="/auth/login" className="underline" style={{ color: "var(--brand-accent)" }}>
              להתחברות
            </a>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">סיסמה חדשה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border"
                style={{ borderColor: "var(--brand-border)" }}
                dir="ltr"
              />
              <PasswordRequirements password={password} />
            </div>
            <div>
              <label className="block text-sm mb-1">אימות סיסמה</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border"
                style={{ borderColor: "var(--brand-border)" }}
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !validation.ok}
              className="w-full h-11 rounded-lg text-white font-semibold disabled:opacity-60"
              style={{ background: "var(--brand-accent)" }}
            >
              שמור
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
