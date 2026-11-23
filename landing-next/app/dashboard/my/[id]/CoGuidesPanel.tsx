"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";

export interface CoGuideItem {
  userId: string;
  name: string | null;
  email: string | null;
}

interface CoGuidesPanelProps {
  landingId: string;
  guides: CoGuideItem[];
  /** Only the owner (or an admin) can add or remove. */
  canEdit: boolean;
}

export function CoGuidesPanel({ landingId, guides, canEdit }: CoGuidesPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const call = (method: "POST" | "DELETE", body: object, okMessage: string) => {
    startTransition(async () => {
      try {
        const r = await fetch(`/api/landings/${landingId}/co-guides`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.success) throw new Error(data.error || "הפעולה נכשלה");
        toast(okMessage, "success");
        if (method === "POST") setEmail("");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "הפעולה נכשלה", "error");
      }
    });
  };

  return (
    <div className="space-y-4">
      {guides.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אין עדיין מדריך שותף בקורס.
        </p>
      ) : (
        <ul className="space-y-2">
          {guides.map((g) => (
            <li
              key={g.userId}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
              style={{ borderColor: "var(--brand-border)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{g.name || g.email || "מדריך"}</p>
                {g.name && g.email && (
                  <p
                    className="text-xs truncate"
                    dir="ltr"
                    style={{ color: "var(--brand-text-muted)" }}
                  >
                    {g.email}
                  </p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm("להסיר את המדריך מהקורס?")) return;
                    call("DELETE", { userId: g.userId }, "המדריך הוסר מהקורס");
                  }}
                  className="text-xs underline min-h-12 px-2 disabled:opacity-50"
                  style={{ color: "#c43030" }}
                >
                  הסר
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            call("POST", { email }, "המדריך נוסף. הקורס יופיע אצלו בעמוד הקורסים שלי");
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="מייל של המדריך השותף"
            dir="ltr"
            required
            className="flex-1 h-12 px-4 rounded-lg border bg-white text-gray-900"
            style={{ borderColor: "var(--brand-border)" }}
          />
          <button
            type="submit"
            disabled={isPending}
            className="av-btn av-btn-primary disabled:opacity-50"
          >
            הוסף מדריך שותף
          </button>
        </form>
      ) : (
        <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
          רק מנהל הקורס הראשי יכול להוסיף או להסיר מדריכים.
        </p>
      )}
    </div>
  );
}
