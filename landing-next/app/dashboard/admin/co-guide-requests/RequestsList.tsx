"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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

  const decide = (id: string, action: "approve" | "reject") => {
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/co-guide-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.success) throw new Error(data.error || "הפעולה נכשלה");
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

  if (items.length === 0) {
    return (
      <p className="p-6 text-sm text-center" style={{ color: "var(--brand-text-muted)" }}>
        אין בקשות שממתינות לאישור.
      </p>
    );
  }

  return (
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
  );
}
