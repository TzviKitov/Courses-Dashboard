import Link from "next/link";
import { SiteFooter } from "@/components/privacy/SiteFooter";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 prose prose-sm" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">מדיניות פרטיות</h1>
      <p className="text-sm text-gray-500">טיוטה הנדסית — לאישור עורך דין. עודכן: אוגוסט 2026.</p>
      <p>
        CourseFlow אוסף מידע לצורך הרשמה לקורסים, ניהול מדריכים, ומעקב אחר השתתפות.
        בעל השליטה במאגר ייקבע במסמך הגדרות המאגר (טיוטה פנימית לאישור עורך דין).
      </p>
      <h2 className="text-lg font-semibold mt-6">איזה מידע נאסף</h2>
      <ul className="list-disc pr-5 space-y-1">
        <li>שם, טלפון, אימייל (אופציונלי), שנת לידה, מקור הגעה.</li>
        <li>לקטינים: שם וטלפון של הורה/אפוטרופוס והסכמתו.</li>
        <li>הערות מדריך על התנהגות בקורס, כולל היבט רגשי — מידע בעל רגישות מיוחדת.</li>
        <li>קבצים שצורפו בטופס קבלה, נתוני השמה, ויומני גישה טכניים (IP, זמן).</li>
      </ul>
      <h2 className="text-lg font-semibold mt-6">למה</h2>
      <p>
        תפעול הקורס, יצירת קשר, מעקב מדריכים, דיווח מצרפי (בלי שמות) להנהלה, ואבטחת המידע.
        הודעות שיווקיות נשלחות רק אם סומנה תיבת opt-in נפרדת.
      </p>
      <h2 className="text-lg font-semibold mt-6">מעבירים / מעבדים</h2>
      <p>
        Supabase (איחוד אירופי), Vercel, Resend (אימייל), Google (OAuth ו-Gemini לתוכן קורס בלבד — לא פרטי נרשמים),
        Microsoft Azure (OAuth למדריכים), ספק SMS ישראלי.
      </p>
      <h2 className="text-lg font-semibold mt-6">זכויות</h2>
      <p>
        ניתן לבקש עיון, תיקון או מחיקה בטופס{" "}
        <Link href="/rights" className="underline">
          מימוש זכויות
        </Link>
        . לקטינים — ההורה/אפוטרופוס רשאי לפעול בשמם.
      </p>
      <p className="mt-8">
        <Link href="/" className="underline">
          חזרה
        </Link>
      </p>
      <SiteFooter />
    </main>
  );
}
