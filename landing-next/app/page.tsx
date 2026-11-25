// The public gallery opens straight at the site's main address, with no
// redirect to /dashboard (a path that reads like an admin panel to URL filters).
// /dashboard keeps working for existing links and filters.
export { default } from "./dashboard/page";
import { SITE_NAME, SITE_OWNER } from "@/constants/site";

export const metadata = {
  // The layout title template does not apply to the root segment itself.
  title: `גלריית קורסים, קבוצות ואירועים | ${SITE_NAME} | ${SITE_OWNER}`,
  description: "כל הקורסים, הקבוצות והאירועים הזמינים, עם סינון וחיפוש.",
};

export const dynamic = "force-dynamic";
