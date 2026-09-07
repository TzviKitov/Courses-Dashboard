"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-4), { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-region pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg"
            style={{
              background: "var(--brand-surface, #fff)",
              borderColor:
                item.kind === "error"
                  ? "var(--brand-error, #b91c1c)"
                  : item.kind === "success"
                    ? "var(--brand-success, #047857)"
                    : "var(--brand-border, #cbd5e1)",
              color: "var(--brand-text, #0f172a)",
            }}
          >
            <span
              className="material-symbols-outlined mt-0.5 shrink-0"
              aria-hidden
              style={{
                fontSize: 22,
                color:
                  item.kind === "error"
                    ? "var(--brand-error, #b91c1c)"
                    : item.kind === "success"
                      ? "var(--brand-success, #047857)"
                      : "var(--brand-accent, #1e3a8a)",
              }}
            >
              {item.kind === "error"
                ? "error"
                : item.kind === "success"
                  ? "check_circle"
                  : "info"}
            </span>
            <p className="flex-1 text-sm font-medium leading-5">{item.message}</p>
            <button
              type="button"
              className="shrink-0 min-h-12 min-w-12 inline-flex items-center justify-center rounded-lg"
              aria-label="סגור הודעה"
              onClick={() => dismiss(item.id)}
              style={{ color: "var(--brand-text-muted, #64748b)" }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (message: string) => {
        if (typeof window !== "undefined") window.alert(message);
      },
    };
  }
  return ctx;
}
