import type { Metadata } from "next";
import { Karantina, Playpen_Sans_Hebrew, Rubik } from "next/font/google";
import "material-symbols/rounded.css";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/constants/site";
import "./globals.css";
import "./management-tables.css";

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
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var apply = function (dark) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  };
  apply(media.matches);
  media.addEventListener("change", function (event) { apply(event.matches); });
} catch (e) {}
`;

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body
        className={`${rubik.variable} ${karantina.variable} ${playpen.variable} antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
