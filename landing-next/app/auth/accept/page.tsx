"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function AcceptInner() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash") || "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (otpErr) throw otpErr;
      window.location.href = "/auth/set-password";
    } catch {
      setError("הקישור פג תוקף או כבר נוצל. בקש/י מהמנהל הזמנה חדשה, או השתמש/י ב״שכחתי סיסמה״.");
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--brand-bg, #f8fafc)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 space-y-4 text-center"
        style={{
          background: "var(--brand-surface, #fff)",
          borderColor: "var(--brand-border, #e2e8f0)",
        }}
      >
        <h1 className="av-h2">ברוכים הבאים</h1>
        <p className="text-sm">לחצו על הכפתור כדי להמשיך להגדרת סיסמה.</p>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void onContinue()}
          disabled={loading || !tokenHash}
          className="av-btn av-btn-primary w-full"
        >
          {loading ? "רגע..." : "המשך להגדרת סיסמה"}
        </button>
      </div>
    </main>
  );
}

export default function AcceptPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInner />
    </Suspense>
  );
}
