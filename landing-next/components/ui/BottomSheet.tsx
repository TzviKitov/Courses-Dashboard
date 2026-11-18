"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startY: number; lastY: number } | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    dragRef.current = { startY: event.clientY, lastY: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const next = Math.max(0, event.clientY - drag.startY);
    drag.lastY = next;
    panel.style.transform = `translateY(${next}px)`;
  };

  const endDrag = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    if (drag.lastY > 80) {
      onClose();
      return;
    }
    panel.style.transform = "";
  };

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="סגירת הסינון"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="av-sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto px-5 pt-2.5"
        style={{ paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          type="button"
          className="block w-full py-2 cursor-grab"
          aria-label="גרירה לסגירה"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="av-sheet-handle block" />
        </button>
        <div className="flex items-center gap-3">
          <h2 id={titleId} className="av-h2">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="av-btn av-btn-ghost"
            aria-label="סגירה"
            style={{ marginInlineStart: "auto", width: 44, padding: 0, borderRadius: 999 }}
            onClick={onClose}
          >
            <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
