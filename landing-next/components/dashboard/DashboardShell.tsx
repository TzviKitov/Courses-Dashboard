import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardNav } from "./DashboardNav";

interface DashboardShellProps {
  children: ReactNode;
  /** Optional headline above the children, e.g. "כל הקורסים". */
  title?: string;
  /** Optional sub-description below the headline. */
  subtitle?: string;
  /** Optional right-side actions (e.g. a "צור קורס" CTA). */
  actions?: ReactNode;
  /** Visual context only; routes, permissions and behavior stay unchanged. */
  theme?: "public" | "management";
}

/**
 * Dashboard layout shell - header, container width, footer.
 * Uses --brand-* tokens defined in globals.css so the visual family stays
 * consistent across the dashboard regardless of any per-landing colors.
 */
export function DashboardShell({
  children,
  title,
  subtitle,
  actions,
  theme = "management",
}: DashboardShellProps) {
  const isPublic = theme === "public";

  return (
    <div
      className="min-h-screen flex flex-col"
      data-theme={theme}
      style={{ background: "var(--brand-page-bg)", color: "var(--brand-text)" }}
    >
      {!isPublic && (
        <div
          className="min-h-8 px-4 flex items-center justify-center text-center text-sm font-semibold text-white"
          style={{ background: "var(--brand-accent)" }}
        >
          מצב ניהול פנימי · סביבת עבודה לצוות ההדרכה והניהול
        </div>
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{
          background: "rgba(255,255,255,0.92)",
          borderColor: "var(--brand-border)",
        }}
        suppressHydrationWarning
      >
        <div
          className={`${isPublic ? "max-w-7xl" : "max-w-[90rem]"} mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-4`}
          suppressHydrationWarning
        >
          <Link href="/dashboard" className="flex items-center gap-3 hover-nudge rounded-md">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
              style={{ background: "var(--brand-accent)" }}
            >
              <span style={{ color: "var(--brand-accent-contrast)" }}>CF</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold leading-tight" style={{ color: "var(--brand-text)" }}>
                {isPublic ? "זירת הנוער וההכשרות" : "מערכת ניהול ההכשרות"}
              </span>
              <span className="text-sm leading-tight" style={{ color: "var(--brand-text-muted)" }}>
                החטיבה לקידום נוער וצעירים, עיריית ירושלים
              </span>
            </div>
          </Link>

          <DashboardNav theme={theme} />
        </div>
      </header>

      {/* Main */}
      <main
        className={`flex-1 w-full ${isPublic ? "max-w-7xl" : "max-w-[90rem]"} mx-auto px-4 sm:px-6 lg:px-8 py-8`}
      >
        {(title || subtitle || actions) && (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              {title && (
                <h1
                  className={`${isPublic ? "text-[2rem] lg:text-5xl" : "text-[2rem]"} font-bold leading-tight`}
                  style={{ color: "var(--brand-text)" }}
                >
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-2 text-base leading-6" style={{ color: "var(--brand-text-muted)" }}>
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}

        {children}
      </main>

      {/* Footer - textual only, no official logos */}
      <footer
        className="border-t mt-12"
        style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}
      >
        <div className={`${isPublic ? "max-w-7xl" : "max-w-[90rem]"} mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center space-y-2`}>
          <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
            מערכת הכשרות  · החטיבה לקידום נוער וצעירים, עיריית
            ירושלים · יישום עצמאי, ללא לוגואים רשמיים.
          </p>
          <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
            <Link href="/privacy" className="underline">מדיניות פרטיות</Link>
            {" · "}
            <Link href="/terms" className="underline">תנאי שימוש</Link>
            {" · "}
            <Link href="/rights" className="underline">עיון / תיקון / מחיקה</Link>
            {" · "}
            <Link href="/accessibility" className="underline">נגישות</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
