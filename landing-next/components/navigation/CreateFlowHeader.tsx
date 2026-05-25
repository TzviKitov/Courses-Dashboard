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
        "sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 shadow-sm",
    },
    createElement(
      "div",
      { className: "max-w-7xl mx-auto flex items-center justify-between" },
      createElement(
        Link,
        { href: "/dashboard", className: "flex items-center gap-4 text-gray-900 group" },
        createElement(
          "div",
          { className: "w-8 h-8 text-primary" },
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
          { className: "text-xl font-bold tracking-tight group-hover:opacity-80" },
          "גלריית הכשרות"
        )
      ),
      createElement(
        "nav",
        { className: "flex items-center gap-2 sm:gap-3" },
        createElement(
          Link,
          {
            href: "/dashboard",
            className:
              "px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50",
          },
          "גלריה"
        ),
        user
          ? createElement(
              Link,
              {
                href: "/dashboard/my",
                className:
                  "px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50",
              },
              "הקורסים שלי"
            )
          : authAvailable
            ? createElement(
                Link,
                {
                  href: signInRedirectUrl(signInReturnTo),
                  className:
                    "px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50",
                },
                "התחבר"
              )
            : null
      )
    )
  );
}
