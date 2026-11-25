import Link from "next/link";
import { SITE_NAME, SITE_OWNER, SITE_OWNER_ADDRESS, SITE_OWNER_URL } from "@/constants/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-500 space-x-3 space-x-reverse">
      <p className="mb-2">
        {SITE_NAME} מופעל על ידי{" "}
        <a href={SITE_OWNER_URL} className="underline" rel="noopener">
          {SITE_OWNER}
        </a>
        {" · "}
        {SITE_OWNER_ADDRESS}
      </p>
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
