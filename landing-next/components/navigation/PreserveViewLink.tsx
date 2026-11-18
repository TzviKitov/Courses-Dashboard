"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import {
  replacePreservingView,
  type PreserveViewOptions,
} from "@/lib/navigation/preserve-view";

/**
 * Same-page link that updates the query without jumping to the top.
 * The page still needs one mounted `usePreserveViewNavigation` to restore focus.
 */
export function PreserveViewLink({
  href,
  focus,
  fallbackFocus,
  className,
  style,
  children,
}: {
  href: string;
  focus?: string;
  fallbackFocus?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        event.preventDefault();
        const options: PreserveViewOptions = {};
        if (focus) options.focus = focus;
        if (fallbackFocus) options.fallbackFocus = fallbackFocus;
        replacePreservingView(router, href, options);
      }}
    >
      {children}
    </a>
  );
}
