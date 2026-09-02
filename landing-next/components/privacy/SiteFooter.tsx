import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-500 space-x-3 space-x-reverse">
      <Link href="/privacy" className="underline">
        מדיניות פרטיות
      </Link>
      <Link href="/terms" className="underline">
        תנאי שימוש
      </Link>
      <Link href="/rights" className="underline">
        עיון / תיקון / מחיקה
      </Link>
      <Link href="/accessibility" className="underline">
        נגישות
      </Link>
    </footer>
  );
}
