"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface MyCoursesActionsProps {
  landingId: string;
  isPublic: boolean;
}

export function MyCoursesActions({ landingId, isPublic }: MyCoursesActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const togglePublic = () => {
    startTransition(async () => {
      setError("");
      try {
        const r = await fetch(`/api/landings/${landingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_public: !isPublic }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("למחוק את הקורס לצמיתות? לא ניתן לבטל פעולה זו.")) return;
    startTransition(async () => {
      setError("");
      try {
        const r = await fetch(`/api/landings/${landingId}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <a
          href={`/api/landings/${landingId}/registrations?format=csv`}
          className="text-xs font-medium underline"
          style={{ color: "var(--brand-accent)" }}
        >
          נרשמים (CSV)
        </a>
        <button
          type="button"
          onClick={togglePublic}
          disabled={isPending}
          className="text-xs font-medium underline disabled:opacity-50"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {isPublic ? "הסתר" : "פרסם"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium underline disabled:opacity-50"
          style={{ color: "#c43030" }}
        >
          מחק
        </button>
      </div>
      {error && (
        <span className="text-[11px]" style={{ color: "#c43030" }}>
          {error}
        </span>
      )}
    </div>
  );
}
