"use client";

import { useEffect, useRef, useState } from "react";

const FOOTER_GAP_PX = 12;

/**
 * Floating support balloon — fixed under the header on desktop, thumb-zone
 * on mobile. Lifts just above the site footer when the user scrolls to it.
 */
export function SupportBanner() {
  const bannerRef = useRef<HTMLElement>(null);
  const liftRef = useRef(0);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) {
        if (liftRef.current !== 0) {
          liftRef.current = 0;
          setLift(0);
        }
        return;
      }

      const visualBottom = banner.getBoundingClientRect().bottom;
      const restBottom = visualBottom + liftRef.current;
      const nextLift = Math.max(
        0,
        Math.ceil(restBottom + FOOTER_GAP_PX - footer.getBoundingClientRect().top)
      );

      if (nextLift !== liftRef.current) {
        liftRef.current = nextLift;
        setLift(nextLift);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    const observer = new ResizeObserver(schedule);
    observer.observe(banner);
    const footer = document.querySelector("footer");
    if (footer) observer.observe(footer);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <aside
      ref={bannerRef}
      className="fixed z-30 left-3 bottom-3 sm:bottom-auto sm:top-[4.75rem] w-[min(13rem,25vw)] max-sm:w-[min(11rem,46vw)] pointer-events-none motion-safe:transition-transform motion-safe:duration-200"
      aria-label="תמיכה רגשית"
      style={{
        transform: lift ? `translateY(-${lift}px)` : undefined,
      }}
    >
      <div
        className="pointer-events-auto relative rounded-2xl border px-2.5 py-2"
        style={{
          background:
            "linear-gradient(160deg, var(--brand-accent-soft) 0%, var(--brand-surface) 70%)",
          borderColor: "var(--brand-border)",
          boxShadow: "var(--brand-shadow-elevated)",
        }}
      >
        <span
          className="absolute -top-1.5 left-5 w-2.5 h-2.5 rotate-45 border-l border-t"
          style={{
            background: "var(--brand-accent-soft)",
            borderColor: "var(--brand-border)",
          }}
          aria-hidden
        />

        <p
          className="relative text-sm leading-snug m-0"
          style={{ color: "var(--brand-text)" }}
        >
          מרגישים לבד? רוצים לדבר עם מישהו?
          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              className="inline-flex shrink-0 w-6 h-6 rounded-lg items-center justify-center"
              style={{
                background: "var(--brand-surface)",
                color: "var(--brand-accent)",
                boxShadow: "var(--brand-shadow)",
              }}
              aria-hidden
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                handshake
              </span>
            </span>
            <a
              href="https://maanebareshet.co.il/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 decoration-2 hover-wiggle"
              style={{ color: "var(--brand-accent)" }}
            >
              מענה ברשת
            </a>
          </span>
        </p>
      </div>
    </aside>
  );
}
