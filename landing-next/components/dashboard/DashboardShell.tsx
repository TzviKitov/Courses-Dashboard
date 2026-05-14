import Link from "next/link";
import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
  /** Optional headline above the children, e.g. "כל הקורסים". */
  title?: string;
  /** Optional sub-description below the headline. */
  subtitle?: string;
  /** Optional right-side actions (e.g. a "צור קורס" CTA). */
  actions?: ReactNode;
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
}: DashboardShellProps) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--brand-page-bg)", color: "var(--brand-text)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{
          background: "rgba(255,255,255,0.92)",
          borderColor: "var(--brand-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
              style={{ background: "var(--brand-accent)" }}
            >
              CF
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold leading-tight" style={{ color: "var(--brand-text)" }}>
                גלריית הכשרות
              </span>
              <span className="text-xs leading-tight" style={{ color: "var(--brand-text-muted)" }}>
                במערכת הקשורה למרכז הידע
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
              style={{ color: "var(--brand-text)" }}
            >
              גלריה
            </Link>
            <Link
              href="/create"
              className="px-4 py-2 text-sm font-bold rounded-md text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--brand-accent)" }}
            >
              צור קורס חדש
            </Link>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(title || subtitle || actions) && (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              {title && (
                <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--brand-text)" }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm" style={{ color: "var(--brand-text-muted)" }}>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
            מערכת הכשרות במשפחת מרכז הידע · החטיבה לקידום נוער וצעירים, עיריית
            ירושלים · יישום עצמאי, ללא לוגואים רשמיים.
          </p>
        </div>
      </footer>
    </div>
  );
}
