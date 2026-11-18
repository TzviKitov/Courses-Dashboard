import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";
import { DashboardNav } from "./DashboardNav";
import { ManagementBottomNavHost } from "./ManagementBottomNavHost";
import { FitManagementTables } from "./FitManagementTables";
import { StickyShellHeader } from "./StickyShellHeader";

interface DashboardShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  theme?: "public" | "management";
}

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
      className={`min-h-screen flex flex-col ${isPublic ? "pb-28 md:pb-0" : "pb-20 md:pb-0"}`}
      data-surface={theme}
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {!isPublic && (
        <div
          className="min-h-8 px-4 flex items-center justify-center text-center text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
        >
          מצב ניהול פנימי · סביבת עבודה לצוות ההדרכה והניהול
        </div>
      )}

      <StickyShellHeader>
        <div className={`${isPublic ? "max-w-[1280px]" : "max-w-[90rem]"} mx-auto px-4 sm:px-6 min-h-16 py-2.5 flex items-center gap-3 sm:gap-4`}>
          <Link href="/dashboard" className="av-brand">
            {/* The mark is the illustration supplied with the brand demo, used with approval. */}
            <img src="/brand/avuyoyo-mark.svg" alt="" width={56} height={46} className="av-logo" />
            <span className="min-w-0">
              <b>{SITE_NAME}</b>
              <small>{SITE_DESCRIPTION}</small>
            </span>
          </Link>
          <DashboardNav theme={theme} />
        </div>
      </StickyShellHeader>

      <main className={`flex-1 w-full ${isPublic ? "max-w-[1280px]" : "max-w-[90rem] px-4 sm:px-6 lg:px-8 py-8"} mx-auto`}>
        {(title || subtitle || actions) && (
          <div className={isPublic ? "px-4 sm:px-6 pt-8 md:pt-9" : "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8"}>
            <div>
              {title && (isPublic ? <h1 className="av-display">{title}</h1> : (
                <h1 className="text-[2rem] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{title}</h1>
              ))}
              {subtitle && (isPublic ? <p className="av-lede">{subtitle}</p> : (
                <p className="mt-2 text-base leading-6" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>
              ))}
            </div>
            {actions && <div className="flex items-center gap-2 mt-4">{actions}</div>}
          </div>
        )}
        {children}
      </main>

      <footer className="border-t mt-12" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className={`${isPublic ? "max-w-[1280px]" : "max-w-[90rem]"} mx-auto px-4 sm:px-6 py-6 text-center space-y-2`}>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {SITE_NAME} · {SITE_DESCRIPTION}
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
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
      {!isPublic && <FitManagementTables />}
      <ManagementBottomNavHost onlyWhenAuthenticated={isPublic} />
    </div>
  );
}
