import Link from "next/link";
import { createElement } from "react";
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";
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
        createElement("img", {
          src: "/brand/avuyoyo-mark.svg",
          alt: "",
          width: 56,
          height: 46,
          className: "av-logo",
        }),
        createElement(
          "span",
          { className: "flex flex-col leading-tight" },
          createElement(
            "b",
            { style: { fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 0.9 } },
            SITE_NAME
          ),
          createElement(
            "span",
            {
              className: "text-xs font-medium",
              style: { color: "var(--brand-text-muted)" },
            },
            SITE_DESCRIPTION
          )
        )
      ),
      createElement(
        "nav",
        { className: "flex items-center gap-2 sm:gap-3" },
        createElement(
          Link,
          {
            href: "/dashboard",
            className: "hidden md:inline-flex px-3 min-h-12 items-center text-sm font-medium rounded-md hover-wiggle",
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
                  "hidden md:inline-flex px-3 min-h-12 items-center text-sm font-medium rounded-md hover-wiggle",
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
