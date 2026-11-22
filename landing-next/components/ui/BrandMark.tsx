import type { SVGProps } from "react";

/**
 * Stone-arch gate: the Avuyoyo mark. A blue gate inside a ring of dressed stones, on a course of wall.
 * Colours come from CSS variables (see .av-mark in app/brand/components.css) so it follows light and dark.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...props} className={`av-mark${props.className ? ` ${props.className}` : ""}`}>
      <path d="M6.0 33.5 A26 26 0 0 1 7.4 25.6 L17.8 29.1 A15 15 0 0 0 17.0 33.7 Z" fill="var(--mark-a)"/><path d="M7.7 24.6 A26 26 0 0 1 11.8 17.7 L20.3 24.6 A15 15 0 0 0 18.0 28.6 Z" fill="var(--mark-b)"/><path d="M12.4 16.9 A26 26 0 0 1 18.6 11.7 L24.3 21.2 A15 15 0 0 0 20.7 24.1 Z" fill="var(--mark-a)"/><path d="M19.4 11.2 A26 26 0 0 1 27.0 8.5 L29.1 19.3 A15 15 0 0 0 24.8 20.9 Z" fill="var(--mark-b)"/><path d="M28.0 8.3 A26 26 0 0 1 36.0 8.3 L34.3 19.2 A15 15 0 0 0 29.7 19.2 Z" fill="var(--mark-a)"/><path d="M37.0 8.5 A26 26 0 0 1 44.6 11.2 L39.2 20.9 A15 15 0 0 0 34.9 19.3 Z" fill="var(--mark-b)"/><path d="M45.4 11.7 A26 26 0 0 1 51.6 16.9 L43.3 24.1 A15 15 0 0 0 39.7 21.2 Z" fill="var(--mark-a)"/><path d="M52.2 17.7 A26 26 0 0 1 56.3 24.6 L46.0 28.6 A15 15 0 0 0 43.7 24.6 Z" fill="var(--mark-b)"/><path d="M56.6 25.6 A26 26 0 0 1 58.0 33.5 L47.0 33.7 A15 15 0 0 0 46.2 29.1 Z" fill="var(--mark-a)"/><rect x="6.0" y="34.0" width="11.0" height="5.4" rx="1.2" fill="var(--mark-a)"/><rect x="6.0" y="40.3" width="11.0" height="5.4" rx="1.2" fill="var(--mark-b)"/><rect x="6.0" y="46.6" width="11.0" height="5.4" rx="1.2" fill="var(--mark-a)"/><rect x="47.0" y="34.0" width="11.0" height="5.4" rx="1.2" fill="var(--mark-b)"/><rect x="47.0" y="40.3" width="11.0" height="5.4" rx="1.2" fill="var(--mark-a)"/><rect x="47.0" y="46.6" width="11.0" height="5.4" rx="1.2" fill="var(--mark-b)"/><path d="M17 52V34a15 15 0 0 1 30 0v18Z" fill="var(--mark-gate)"/><path d="M25 52V36a7 7 0 0 1 14 0v16Z" fill="var(--mark-inner)"/><rect x="3" y="52" width="58" height="9" rx="3" fill="var(--mark-brick)"/><path d="M3 56.5h58M16 52v4.5M48 52v4.5M24 56.5v4.5M40 56.5v4.5" stroke="var(--mark-mortar)" strokeWidth="1.4" fill="none"/>
    </svg>
  );
}
