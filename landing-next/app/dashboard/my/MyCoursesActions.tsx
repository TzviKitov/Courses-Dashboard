"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";

interface MyCoursesActionsProps {
  landingId: string;
  isPublic: boolean;
}

export function MyCoursesActions({ landingId, isPublic }: MyCoursesActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const togglePublic = () => {
    startTransition(async () => {
      try {
        const r = await fetch(`/api/landings/${landingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_public: !isPublic }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "עדכון הסטטוס נכשל");
        }
        toast(isPublic ? "הקורס הוסתר" : "הקורס פורסם", "success");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "עדכון הסטטוס נכשל", "error");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("למחוק את הקורס לצמיתות? לא ניתן לבטל פעולה זו.")) return;
    startTransition(async () => {
      try {
        const r = await fetch(`/api/landings/${landingId}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "המחיקה נכשלה");
        }
        toast("הקורס נמחק", "success");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "המחיקה נכשלה", "error");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/dashboard/my/${landingId}/registrants`}
        prefetch
        className="inline-flex items-center justify-center px-3 min-h-12 text-xs font-bold rounded-md text-white hover-nudge"
        style={{ background: "var(--brand-accent)" }}
      >
        נרשמים
      </Link>
      <a
        href={`/api/landings/${landingId}/registrations?format=csv`}
        onClick={(e) => {
          if (
            !window.confirm(
              "הייצוא כולל שמות וטלפונים. אין להוריד למחשב פרטי. להמשיך?"
            )
          ) {
            e.preventDefault();
          }
        }}
        className="inline-flex items-center justify-center px-3 min-h-12 text-xs font-medium underline hover-wiggle"
        style={{ color: "var(--brand-text-muted)" }}
      >
        CSV
      </a>
      <button
        type="button"
        onClick={togglePublic}
        disabled={isPending}
        className="inline-flex items-center justify-center px-3 min-h-12 text-xs font-medium underline disabled:opacity-50 hover-wiggle"
        style={{ color: "var(--brand-text-muted)" }}
      >
        {isPublic ? "הסתר" : "פרסם"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center justify-center px-3 min-h-12 text-xs font-medium underline disabled:opacity-50 hover-wiggle"
        style={{ color: "#c43030" }}
      >
        מחק
      </button>
    </div>
  );
}
