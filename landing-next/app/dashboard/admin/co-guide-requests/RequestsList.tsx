"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";

export interface RequestItem {
  id: string;
  email: string;
  name: string | null;
  landingId: string;
  courseTitle: string;
  requestedBy: string;
}

export function RequestsList({ items }: { items: RequestItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);

  const decide = (id: string, action: "approve" | "reject") => {
    const email = items.find((i) => i.id === id)?.email ?? "";
    setSent(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/co-guide-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.success) throw new Error(data.error || "הפעולה נכשלה");
        if (action === "approve" && typeof data.inviteLink === "string") {
          setSent({ email, link: data.inviteLink });
        }
        if (action === "reject") toast("הבקשה נדחתה", "success");
        else if (data.warning) toast(String(data.warning), "error");
        else
          toast(
            data.invited
              ? "המדריך נוסף ונשלחה לו הזמנה למייל"
              : "המדריך נוסף לקורס",
            "success"
          );
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "הפעולה נכשלה", "error");
      }
    });
  };

  const linkBox = sent ? (
    <div className="max-w-3xl mb-4 space-y-2">
      <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
        ההזמנה ל-<span dir="ltr">{sent.email}</span> נשלחה. אם המייל לא הגיע (למשל
        נחסם בדואר העירוני), אפשר לשלוח את הקישור האישי הזה בוואטסאפ.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={sent.link}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 h-12 px-3 rounded-lg border bg-white text-gray-900 text-xs"
          style={{ borderColor: "var(--brand-border)" }}
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              .writeText(sent.link)
              .then(() => toast("הקישור הועתק", "success"))
              .catch(() => toast("העתקה נכשלה, סמן והעתק ידנית", "error"));
          }}
          className="av-btn"
        >
          העתק קישור
        </button>
      </div>
    </div>
  ) : null;

  if (items.length === 0) {
    return (
      <>
        {linkBox}
        <p className="p-6 text-sm text-center" style={{ color: "var(--brand-text-muted)" }}>
          אין בקשות שממתינות לאישור.
        </p>
      </>
    );
  }

  return (
    <>
      {linkBox}
      <ul className="space-y-3 max-w-3xl">
      {items.map((it) => (
        <li
          key={it.id}
          className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            background: "var(--brand-surface)",
            borderColor: "var(--brand-border)",
          }}
        >
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold">
              {it.name ? `${it.name} · ` : ""}
              <span dir="ltr">{it.email}</span>
            </p>
            <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
              לקורס{" "}
              <Link href={`/l/${it.landingId}`} className="underline">
                {it.courseTitle}
              </Link>
              , ביקש/ה: {it.requestedBy}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              disabled={isPending}
              onClick={() => decide(it.id, "approve")}
              className="av-btn av-btn-primary disabled:opacity-50"
            >
              אשר ושלח הזמנה
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => decide(it.id, "reject")}
              className="px-4 min-h-12 rounded-lg border text-sm font-medium disabled:opacity-50"
              style={{ borderColor: "var(--brand-border)" }}
            >
              דחה
            </button>
          </div>
        </li>
      ))}
      </ul>
    </>
  );
}
