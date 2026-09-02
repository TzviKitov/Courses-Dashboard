"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function safeRedirect(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard/admin";
  if (path.startsWith("/auth/") && !path.startsWith("/auth/mfa")) {
    return "/dashboard/admin";
  }
  return path;
}

export default function MfaClient() {
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect") || "/dashboard/admin");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"loading" | "enroll" | "verify">("loading");

  const stampTrustAndGo = async () => {
    const res = await fetch("/api/auth/mfa/complete", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string" ? body.error : "שמירת המכשיר נכשלה"
      );
    }
    window.location.href = redirectTo;
  };

  useEffect(() => {
    void (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === "aal2") {
          await stampTrustAndGo();
          return;
        }

        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          setFactorId(totp.id);
          setMode("verify");
          return;
        }

        const pendingTotp = (factors?.all ?? []).filter(
          (f) => f.factor_type === "totp" && f.status !== "verified"
        );
        for (const f of pendingTotp) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }

        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "CourseFlow",
        });
        if (enrollErr) throw enrollErr;
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
        setMode("enroll");
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בטעינת אימות");
        setMode("verify");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("ההעתקה נכשלה — העתיקו ידנית");
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      if (!factorId) throw new Error("חסר מזהה אימות");
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      await stampTrustAndGo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "קוד שגוי");
      setBusy(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">אימות באפליקציה</h1>
      <p className="text-sm text-gray-600 mb-6">
        מנהלים נדרשים לאפליקציית אימות (למשל Google Authenticator או Microsoft
        Authenticator). סרקו את ה־QR <strong>מתוך האפליקציה</strong> — לא עם
        מצלמת הטלפון. אחרי האימות הראשון המכשיר יישמר ל־20 יום; אחרי 30 דקות
        חוסר פעילות תידרש כניסה מחדש בסיסמה או Google בלבד.
      </p>
      {mode === "loading" && <p>טוען…</p>}
      {mode === "enroll" && (
        <div className="space-y-3 mb-4">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR לאפליקציית אימות" className="mx-auto w-48 h-48" />
          )}
          {secret && (
            <div className="space-y-2">
              <p className="text-xs text-center text-gray-600">
                אם הסריקה לא עובדת, הזינו את המפתח ידנית באפליקציה:
              </p>
              <p className="text-xs text-center font-mono break-all" dir="ltr">
                {secret}
              </p>
              <button
                type="button"
                onClick={() => void copySecret()}
                className="w-full h-10 rounded-lg border text-sm font-medium"
              >
                {copied ? "הועתק" : "העתקת המפתח"}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 space-y-3">
        <input
          className="w-full h-12 border rounded-lg px-3 text-center tracking-widest"
          dir="ltr"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy || code.trim().length < 6}
          onClick={() => void submit()}
          className="w-full h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50"
        >
          אימות
        </button>
      </div>
    </main>
  );
}
