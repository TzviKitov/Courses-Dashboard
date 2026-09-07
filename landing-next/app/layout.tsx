import type { Metadata } from "next";
import { Heebo, Rubik } from "next/font/google";
import "material-symbols/outlined.css";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CourseFlow | הרשמה לקורס",
  description: "דף הרשמה לקורס",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body
        className={`${rubik.variable} ${heebo.variable} antialiased bg-gray-50 text-gray-900 min-h-screen`}
        style={{ fontFamily: "var(--font-heebo), sans-serif" }}
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
