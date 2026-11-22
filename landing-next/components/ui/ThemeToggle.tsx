"use client";

import { useEffect, useState } from "react";

/**
 * Light / dark switch. The choice is stored (av-theme) and read by the boot script in
 * app/layout.tsx; until someone chooses, the site follows the device setting.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.getAttribute("data-theme") === "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    // colours ease across for a moment instead of snapping
    root.classList.add("av-theme-anim");
    window.setTimeout(() => root.classList.remove("av-theme-anim"), 320);
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem("av-theme", next);
    } catch {
      /* private mode: the choice just lasts for this page */
    }
  };

  return (
    <button
      type="button"
      className="av-theme-toggle"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
    >
      <span className="material-symbols-rounded av-theme-sun" aria-hidden>
        light_mode
      </span>
      <span className="material-symbols-rounded av-theme-moon" aria-hidden>
        dark_mode
      </span>
    </button>
  );
}
