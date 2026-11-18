"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  className,
  children,
  prefix = false,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  prefix?: boolean;
}) {
  const path = usePathname() ?? "";
  const active = prefix ? path.startsWith(href) : path === href;
  return (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
