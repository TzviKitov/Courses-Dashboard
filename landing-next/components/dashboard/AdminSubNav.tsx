"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/dashboard/admin", label: "סקירה", exact: true },
  { href: "/dashboard/admin/courses", label: "כל הקורסים" },
  { href: "/dashboard/admin/users", label: "משתמשים" },
  { href: "/dashboard/admin/usage", label: "יומן שימוש" },
];

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {LINKS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="px-3 py-1.5 text-sm font-medium rounded-md border transition-colors"
            style={{
              borderColor: "var(--brand-border)",
              background: active ? "var(--brand-accent-soft)" : "var(--brand-surface)",
              color: active ? "var(--brand-accent)" : "var(--brand-text-muted)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
