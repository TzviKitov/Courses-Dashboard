import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Karantina, Playpen_Sans_Hebrew, Rubik } from "next/font/google";
import "material-symbols/rounded.css";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/constants/site";
import "./globals.css";
import "./management-tables.css";
import "./brand/polish.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const karantina = Karantina({
  variable: "--font-karantina",
  subsets: ["hebrew", "latin"],
  weight: ["400", "700"],
  display: "swap",
});

const playpen = Playpen_Sans_Hebrew({
  variable: "--font-playpen",
  subsets: ["hebrew", "latin"],
  weight: ["500", "600"],
  display: "swap",
});

const themeBoot = `
try {
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem("av-theme"); } catch (e) {}
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var apply = function (dark) {
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.style.colorScheme = dark ? "dark" : "light";
  };
  // a choice made with the header toggle wins; otherwise follow the device
  apply(stored ? stored === "dark" : media.matches);
  media.addEventListener("change", function (event) {
    var saved = null;
    try { saved = localStorage.getItem("av-theme"); } catch (e) {}
    if (!saved) apply(event.matches);
  });
  // first paint of a visit: lets the page play its entrance once, never on later navigations
  try {
    if (!sessionStorage.getItem("av-seen")) {
      root.setAttribute("data-av-first", "1");
      sessionStorage.setItem("av-seen", "1");
      setTimeout(function () { root.removeAttribute("data-av-first"); }, 1600);
    }
  } catch (e) {}
} catch (e) {}
`;

/** viewport-fit=cover lets the safe-area insets work on phones; theme colour tints the browser bar. */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF3DA" },
    { media: "(prefers-color-scheme: dark)", color: "#0E2230" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by proxy.ts. Reading it also makes every page render per request, which a
  // nonce-based CSP requires (a cached page would carry a stale nonce).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body
        className={`${rubik.variable} ${karantina.variable} ${playpen.variable} antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <a href="#main" className="av-skip">
          דילוג לתוכן
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
