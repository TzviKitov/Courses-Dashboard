"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * App bar that stays at the top of the viewport.
 * Publishes its height so table column headers can stick just beneath it.
 */
export function StickyShellHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    const surface = header?.closest("[data-surface]");
    if (!header || !(surface instanceof HTMLElement)) return;

    const apply = () => {
      const height = Math.round(header.getBoundingClientRect().height);
      surface.style.setProperty("--shell-header-height", `${height}px`);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      data-shell-header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
        borderBottom: "1.5px solid var(--color-border)",
      }}
    >
      {children}
    </header>
  );
}
