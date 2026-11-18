"use client";

import { useEffect } from "react";

const MIN_HEIGHT = 280;
const GAP = 16;

/**
 * Keeps each management table inside the visible page, under its own title,
 * so the column header stays on screen while the rows scroll.
 */
export function FitManagementTables() {
  useEffect(() => {
    const fit = () => {
      const header = document.querySelector("[data-shell-header]");
      const headerHeight = header?.getBoundingClientRect().height ?? 72;
      const fallback = Math.max(MIN_HEIGHT, Math.round(window.innerHeight - headerHeight - GAP));
      const wraps = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-surface='management'] .overflow-x-auto:has(table)"
        ),
      ];
      const heights = wraps.map((el) => {
        const docTop = el.getBoundingClientRect().top + window.scrollY;
        const available = window.innerHeight - docTop - GAP;
        return available >= MIN_HEIGHT ? Math.floor(available) : fallback;
      });
      wraps.forEach((el, index) => {
        const value = `${heights[index]}px`;
        if (el.style.maxHeight !== value) el.style.maxHeight = value;
        if (el.dataset.scrollBound !== "1") {
          el.dataset.scrollBound = "1";
          el.addEventListener(
            "scroll",
            () => {
              el.toggleAttribute("data-scrolled", el.scrollTop > 2);
            },
            { passive: true }
          );
        }
        el.toggleAttribute("data-scrolled", el.scrollTop > 2);
      });
    };

    fit();
    const observer = new ResizeObserver(fit);
    const surface = document.querySelector("[data-surface='management']");
    const header = document.querySelector("[data-shell-header]");
    if (surface) observer.observe(surface);
    if (header) observer.observe(header);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return null;
}
