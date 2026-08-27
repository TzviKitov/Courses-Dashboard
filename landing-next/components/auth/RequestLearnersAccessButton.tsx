"use client";

import { useState } from "react";

export function RequestLearnersAccessButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const onClick = async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request-learners-access", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "שגיאה");
      setStatus("done");
      setMessage("הבקשה נשלחה למנהל");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "שגיאה");
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={status === "loading" || status === "done"}
        onClick={onClick}
        className="w-full h-10 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--brand-accent)" }}
      >
        {status === "done" ? "הבקשה נשלחה" : "בקש גישה לנתוני נערים מכל הקורסים"}
      </button>
      {message && (
        <p
          className="mt-2 text-xs"
          style={{ color: status === "error" ? "#dc2626" : "var(--brand-text-muted)" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
