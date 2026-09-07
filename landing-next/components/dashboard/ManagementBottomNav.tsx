"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  match: (path: string) => boolean;
}

interface ManagementBottomNavProps {
  showAdmin?: boolean;
  myCoursesHref: string;
  showCreate?: boolean;
  disableMyCourses?: boolean;
}

export function ManagementBottomNav({
  showAdmin = false,
  myCoursesHref,
  showCreate = true,
  disableMyCourses = false,
}: ManagementBottomNavProps) {
  const pathname = usePathname() ?? "";

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "גלריה",
      icon: "grid_view",
      match: (path) => path === "/dashboard",
    },
    {
      href: myCoursesHref,
      label: "הקורסים שלי",
      icon: "school",
      match: (path) => path.startsWith("/dashboard/my"),
    },
    ...(showCreate
      ? [
          {
            href: "/create",
            label: "יצירת קורס",
            icon: "add_circle",
            match: (path: string) => path.startsWith("/create"),
          },
        ]
      : []),
    ...(showAdmin
      ? [
          {
            href: "/dashboard/admin",
            label: "ניהול",
            icon: "admin_panel_settings",
            match: (path: string) => path.startsWith("/dashboard/admin"),
          },
        ]
      : []),
  ];

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="ניווט ניהול"
    >
      <ul className="flex justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          const disabled = item.href === myCoursesHref && disableMyCourses;
          const className =
            "flex flex-col items-center justify-center gap-0.5 min-h-16 px-2 text-xs font-semibold";
          const style = {
            color: active ? "var(--brand-accent)" : "var(--brand-text-muted)",
            opacity: disabled ? 0.45 : 1,
          };

          return (
            <li key={item.label} className="flex-1">
              {disabled ? (
                <span
                  className={className}
                  style={style}
                  aria-disabled="true"
                  title="אזור אישי לנרשמים יתווסף בהמשך"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={className} style={style}>
                  <span className="material-symbols-outlined" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
