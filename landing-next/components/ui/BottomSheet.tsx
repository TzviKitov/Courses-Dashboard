"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EXIT_MS = 280;
/** Fast flick (px per ms) that dismisses even when the distance is short. */
const FLICK_VELOCITY = 0.11;

interface DragState {
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  dy: number;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const closingRef = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(settleTimer.current);
    },
    []
  );

  /** Plays the exit (slide down, backdrop fade) and then tells the parent to close. */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onCloseRef.current();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closingRef.current = false;
      setClosing(false);
      onCloseRef.current();
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
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
  }, [open, requestClose]);

  if (!open) return null;

  /* Track phase: the sheet is the finger (1:1, no easing). Release phase: distance or velocity decides. */
  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (closingRef.current) return;
    window.clearTimeout(settleTimer.current);
    panelRef.current?.classList.remove("is-settling");
    dragRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
      dy: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const raw = event.clientY - drag.startY;
    // resistance above the resting position instead of a hard stop
    const dy = raw < 0 ? raw * 0.2 : raw;
    const now = performance.now();
    drag.velocity = (event.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
    drag.lastY = event.clientY;
    drag.lastT = now;
    drag.dy = dy;
    panel.style.transform = `translateY(${dy}px)`;
    // the backdrop fades by exactly as much as the sheet has left
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / panel.offsetHeight));
    }
  };

  const endDrag = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    const dismiss =
      drag.dy > panel.offsetHeight * 0.4 || (drag.velocity > FLICK_VELOCITY && drag.dy > 20);
    if (dismiss) {
      requestClose();
      return;
    }
    // quick snap back
    panel.classList.add("is-settling");
    panel.style.transform = "";
    if (backdropRef.current) backdropRef.current.style.opacity = "";
    settleTimer.current = window.setTimeout(() => panel.classList.remove("is-settling"), 340);
  };

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <button
        ref={backdropRef}
        type="button"
        className={`av-sheet-backdrop absolute inset-0 bg-black/45${closing ? " is-closing" : ""}`}
        aria-label="סגירת הסינון"
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`av-sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto px-5 pt-2.5${closing ? " is-closing" : ""}`}
        style={{ paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          type="button"
          className="block w-full py-2 cursor-grab"
          style={{ touchAction: "none" }}
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
            onClick={requestClose}
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
