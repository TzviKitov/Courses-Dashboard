"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function safeRedirect(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard/my";
  if (path.startsWith("/auth/") && !path.startsWith("/auth/mfa")) {
    return "/dashboard/my";
  }
  return path;
}

export default function MfaSmsClient({
  initialMasked,
}: {
  initialMasked: string | null;
}) {
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect") || "/dashboard/my");
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState<string | null>(initialMasked);
  const [needPhone, setNeedPhone] = useState(!initialMasked);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    setDevCode(null);
    try {
      const res = await fetch("/api/auth/mfa/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needPhone && phone.trim() ? { phone: phone.trim() } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "שליחת הקוד נכשלה"
        );
      }
      setMasked(typeof body.masked === "string" ? body.masked : masked);
      setNeedPhone(false);
      setSent(true);
      if (typeof body.devCode === "string") setDevCode(body.devCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שליחת הקוד נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "קוד שגוי");
      }
      window.location.href = redirectTo;
    } catch (e) {
      setError(e instanceof Error ? e.message : "קוד שגוי");
      setBusy(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">אימות בקוד SMS</h1>
      <p className="text-sm text-gray-600 mb-6">
        מדריכים מתחברים עם סיסמה (או Google) ואז קוד שנשלח לנייד. אין צורך
        באפליקציית אימות. אחרי האימות המכשיר יישמר ל־20 יום; אחרי 30 דקות חוסר
        פעילות תידרש כניסה מחדש בסיסמה או Google בלבד.
      </p>

      {needPhone && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">מספר נייד ישראלי</label>
          <input
            className="w-full h-12 border rounded-lg px-3"
            dir="ltr"
            placeholder="05XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
      )}

      {masked && !needPhone && (
        <p className="text-sm text-gray-600 mb-3">
          הקוד יישלח אל <span dir="ltr">{masked}</span>
        </p>
      )}

      {!sent ? (
        <button
          type="button"
          disabled={busy || (needPhone && phone.trim().length < 9)}
          onClick={() => void send()}
          className="w-full h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50"
        >
          {busy ? "שולח…" : "שליחת קוד"}
        </button>
      ) : (
        <div className="space-y-3">
          <input
            className="w-full h-12 border rounded-lg px-3 text-center tracking-widest"
            dir="ltr"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {devCode && (
            <p className="text-xs text-amber-700" dir="ltr">
              DEV code: {devCode}
            </p>
          )}
          <button
            type="button"
            disabled={busy || code.trim().length < 6}
            onClick={() => void verify()}
            className="w-full h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50"
          >
            {busy ? "מאמת…" : "אימות"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="w-full h-10 rounded-lg border text-sm"
          >
            שליחה מחדש
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </main>
  );
}
