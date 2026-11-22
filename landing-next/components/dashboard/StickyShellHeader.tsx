"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * App bar that stays at the top of the viewport.
 * Publishes its height so table column headers can stick just beneath it.
 *
 * On the public gallery it also gets out of the way on phones: it slides up while the
 * user scrolls down and comes back on the first scroll up. The sub-title fades once the
 * page has moved. Both are attributes read by polish.css, so no layout changes happen.
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

  useEffect(() => {
    const header = ref.current;
    const surface = header?.closest("[data-surface]");
    if (!header || !(surface instanceof HTMLElement) || surface.dataset.surface !== "public") return;

    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      header.dataset.scrolled = y > 24 ? "true" : "false";
      // small movements and rubber-banding never toggle it
      if (Math.abs(delta) > 6) {
        header.dataset.hidden = delta > 0 && y > 120 ? "true" : "false";
        lastY = y;
      }
      if (y <= 24) header.dataset.hidden = "false";
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
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
