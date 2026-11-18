"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CourseTile } from "@/components/dashboard/CourseTile";
import { useToast } from "@/components/ui/Toast";
import type { LandingsSummary } from "@/lib/supabase/types";

interface BulkCourseGalleryProps {
  items: LandingsSummary[];
  likedIds: string[];
  manageableIds: string[];
}

export function BulkCourseGallery({
  items,
  likedIds,
  manageableIds,
}: BulkCourseGalleryProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const manageableSet = useMemo(() => new Set(manageableIds), [manageableIds]);
  const likedSet = useMemo(() => new Set(likedIds), [likedIds]);

  const setSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const leaveSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const deleteSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/landings/bulk-delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "מחיקת הקורסים נכשלה");
        }

        setConfirmOpen(false);
        leaveSelectionMode();
        toast(
          ids.length === 1 ? "הקורס נמחק" : `${ids.length} קורסים נמחקו`,
          "success"
        );
        router.refresh();
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "מחיקת הקורסים נכשלה",
          "error"
        );
      }
    });
  };

  return (
    <>
      {manageableIds.length > 0 ? (
        <div className="sticky top-[5.65rem] z-30 px-4 sm:px-6 mt-5">
          <div
            className="max-w-[1232px] mx-auto min-h-16 rounded-2xl border px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 94%, transparent)",
              borderColor: "var(--color-border)",
              backdropFilter: "blur(14px)",
            }}
          >
            {selectionMode ? (
              <>
                <div className="min-w-0">
                  <p className="font-bold" style={{ color: "var(--color-text)" }}>
                    בחירת קורסים למחיקה
                  </p>
                  <p
                    className="text-sm tabular-nums"
                    style={{ color: "var(--color-text-muted)" }}
                    aria-live="polite"
                  >
                    נבחרו {selectedIds.size} מתוך {manageableIds.length}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.size === manageableIds.length
                          ? new Set()
                          : new Set(manageableIds)
                      )
                    }
                  >
                    {selectedIds.size === manageableIds.length
                      ? "בטל בחירת הכול"
                      : "בחר הכול"}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={leaveSelectionMode}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    className="av-btn"
                    disabled={selectedIds.size === 0 || isPending}
                    onClick={() => setConfirmOpen(true)}
                    style={{ background: "#b3261e", color: "#fff" }}
                  >
                    <span className="material-symbols-rounded" aria-hidden>
                      delete
                    </span>
                    מחיקה ({selectedIds.size})
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="font-bold" style={{ color: "var(--color-text)" }}>
                    ניהול מהיר
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    אפשר לבחור ולמחוק כמה קורסים ישירות מהגלריה
                  </p>
                </div>
                <button
                  type="button"
                  className="av-btn av-btn-ghost shrink-0"
                  onClick={() => setSelectionMode(true)}
                >
                  <span className="material-symbols-rounded" aria-hidden>
                    checklist
                  </span>
                  בחירה למחיקה
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="av-grid">
        {items.map((item) => (
          <CourseTile
            key={item.id}
            item={item}
            initialLiked={likedSet.has(item.id)}
            selectionMode={selectionMode && manageableSet.has(item.id)}
            selected={selectedIds.has(item.id)}
            onSelectedChange={(selected) => setSelected(item.id, selected)}
          />
        ))}
      </div>

      <DeleteConfirmationDialog
        open={confirmOpen}
        count={selectedIds.size}
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={deleteSelected}
      />
    </>
  );
}

function DeleteConfirmationDialog({
  open,
  count,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="סגירת חלון האישור"
        onClick={onCancel}
        disabled={pending}
      />
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-3xl border p-6 sm:p-7 shadow-2xl"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <div
          className="w-12 h-12 rounded-full grid place-items-center mb-5"
          style={{ background: "color-mix(in srgb, #b3261e 12%, transparent)", color: "#b3261e" }}
        >
          <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 26 }}>
            delete_forever
          </span>
        </div>
        <h2 id={titleId} className="text-xl sm:text-2xl font-bold leading-tight">
          האם אתם בטוחים שתרצו למחוק את הקורסים הנבחרים?
        </h2>
        <p
          id={descriptionId}
          className="mt-3 text-sm sm:text-base leading-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          {count === 1 ? "קורס אחד יימחק לצמיתות." : `${count} קורסים יימחקו לצמיתות.`}
          {" "}לא ניתן לבטל פעולה זו.
        </p>
        <div className="mt-7 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="av-btn av-btn-ghost"
            onClick={onCancel}
            disabled={pending}
          >
            חזרה לגלריה
          </button>
          <button
            type="button"
            className="av-btn"
            onClick={onConfirm}
            disabled={pending}
            style={{ background: "#b3261e", color: "#fff" }}
          >
            {pending ? "מוחקים…" : `כן, למחוק ${count === 1 ? "קורס" : `${count} קורסים`}`}
          </button>
        </div>
      </section>
    </div>
  );
}
