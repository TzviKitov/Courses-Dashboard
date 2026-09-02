import Link from "next/link";
import { SiteFooter } from "@/components/privacy/SiteFooter";

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">תנאי שימוש</h1>
      <p className="text-sm text-gray-500 mb-4">טיוטה — לאישור עורך דין.</p>
      <ul className="list-disc pr-5 space-y-2 text-sm">
        <li>האתר מיועד להרשמה לקורסים ולניהולם על ידי מדריכים מאושרים.</li>
        <li>מדריכים מתחייבים לסודיות ולאי-ייצוא נתוני נערים למחשבים פרטיים.</li>
        <li>אין להעלות קבצים שאינם קשורים לקבלה לקורס.</li>
        <li>השימוש כפוף למדיניות הפרטיות ולדין הישראלי.</li>
      </ul>
      <p className="mt-8 text-sm">
        <Link href="/privacy" className="underline">
          מדיניות פרטיות
        </Link>
      </p>
      <SiteFooter />
    </main>
  );
}
