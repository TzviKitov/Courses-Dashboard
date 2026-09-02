import Link from "next/link";
import { SiteFooter } from "@/components/privacy/SiteFooter";

export default function AccessibilityPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">הצהרת נגישות</h1>
      <p className="text-sm text-gray-500 mb-4">טיוטה — לעדכון מול יועץ נגישות.</p>
      <p className="text-sm leading-6">
        CourseFlow שואף לאפשר שימוש בממשק גם במקלדת ובקורא מסך. הטפסים כוללים תוויות,
        והניווט הראשי זמין ללא עכבר. אם נתקלתם בחסם נגישות, פנו דרך{" "}
        <Link href="/rights" className="underline">
          טופס מימוש זכויות
        </Link>
        .
      </p>
      <SiteFooter />
    </main>
  );
}
