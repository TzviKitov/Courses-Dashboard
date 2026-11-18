"use client";

import { useEffect, useRef, useState } from "react";

const FOOTER_GAP_PX = 12;

/**
 * "מענה ברשת" stays one click away: a green card on desktop, a pill above
 * the bottom navigation on mobile. It lifts above the footer while scrolling.
 */
export function SupportBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);
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

  const liftStyle = lift ? { transform: `translateY(-${lift}px)` } : undefined;

  return (
    <aside ref={bannerRef} className="av-support-slot" aria-label="תמיכה" style={liftStyle}>
      <div className="av-support hidden md:flex">
        <div>
          <b>מרגישים בדידות או קושי?</b>
          <span>אנשי מקצוע מחכים לדבר איתכם</span>
        </div>
        <a className="av-btn av-btn-support" href="https://maanebareshet.co.il/" target="_blank" rel="noopener noreferrer">
          <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>chat</span>
          מענה ברשת
        </a>
      </div>
      <a
        className="av-support-fab av-btn md:hidden"
        href="https://maanebareshet.co.il/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>chat</span>
        מענה ברשת
      </a>
    </aside>
  );
}
