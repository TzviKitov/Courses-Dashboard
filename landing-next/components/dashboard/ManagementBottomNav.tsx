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
      className="av-tabbar md:hidden fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="ראשי"
    >
      <ul className="flex justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          const disabled = item.href === myCoursesHref && disableMyCourses;
          const className =
            "flex flex-col items-center justify-center gap-0.5 min-h-16 px-2 text-xs font-semibold";
          const style = {
            color: active ? "var(--color-primary)" : "var(--color-text-muted)",
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
                  <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 24 }}>
                    {item.icon}
                  </span>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={className} style={style} aria-current={active ? "page" : undefined}>
                  <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 24 }}>
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
