import Link from "next/link";
import { createElement } from "react";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { isSupabaseAuthAvailable, signInRedirectUrl } from "@/lib/auth/guards";

interface CreateFlowHeaderProps {
  signInReturnTo?: string;
}

export async function CreateFlowHeader({
  signInReturnTo = "/create",
}: CreateFlowHeaderProps) {
  const user = await getCurrentUser();
  const authAvailable = isSupabaseAuthAvailable();

  return createElement(
    "header",
    {
      className:
        "sticky top-0 z-50 border-b px-4 sm:px-6 py-2 shadow-sm",
      style: {
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
      },
    },
    createElement(
      "div",
      { className: "max-w-[90rem] mx-auto flex items-center justify-between gap-4" },
      createElement(
        Link,
        {
          href: "/dashboard",
          className: "flex items-center gap-3 hover-nudge",
          style: { color: "var(--brand-text)" },
        },
        createElement(
          "div",
          {
            className: "w-10 h-10 rounded-lg flex items-center justify-center",
            style: {
              background: "var(--brand-accent)",
              color: "var(--brand-accent-contrast)",
            },
          },
          createElement(
            "svg",
            {
              className: "w-full h-full",
              fill: "none",
              viewBox: "0 0 48 48",
              xmlns: "http://www.w3.org/2000/svg",
            },
            createElement("path", {
              clipRule: "evenodd",
              d: "M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z",
              fill: "currentColor",
              fillRule: "evenodd",
            })
          )
        ),
        createElement(
          "span",
          { className: "text-lg sm:text-xl font-bold tracking-tight" },
          "מערכת ניהול ההכשרות"
        )
      ),
      createElement(
        "nav",
        { className: "flex items-center gap-2 sm:gap-3" },
        createElement(
          Link,
          {
            href: "/dashboard",
            className: "px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md hover-wiggle",
            style: { color: "var(--brand-text)" },
          },
          "גלריה"
        ),
        user
          ? createElement(
              Link,
              {
                href: "/dashboard/my",
                className:
                  "px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md hover-wiggle",
                style: { color: "var(--brand-text)" },
              },
              "הקורסים שלי"
            )
          : authAvailable
            ? createElement(
                Link,
                {
                  href: signInRedirectUrl(signInReturnTo),
                  className:
                    "px-3 min-h-12 inline-flex items-center text-sm font-medium rounded-md hover-wiggle",
                  style: { color: "var(--brand-text)" },
                },
                "התחבר"
              )
            : null
      )
    )
  );
}
