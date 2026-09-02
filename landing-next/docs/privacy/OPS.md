# תפעול: סביבות, גיבויים, מבדק חדירות

## סביבות

- **Production:** פרויקט Supabase ייעודי, `USE_SUPABASE_DB=true`, בלי `APPS_SCRIPT_URL`.
- **Staging / Preview:** פרויקט Supabase נפרד. **איסור** על נתוני אמת של קטינים. ראו `scripts/seed-synthetic.ts`.
- אל תשתפו `SUPABASE_SERVICE_ROLE_KEY` של פרודקשן ב-Preview.

## גיבויים (PITR + restore)

1. Supabase Dashboard → Database → Backups: להפעיל PITR (תוכנית בתשלום).
2. אחסון `registration-files`: לוודא גיבוי/שכפול לפי התוכנית.
3. **RPO מוצע:** 24 שעות. **RTO מוצע:** 8 שעות.
4. אחת לשנה: תרגיל restore לסביבת staging + שמירת דוח (`docs/privacy/RESTORE_DRILL.md`).
5. הצפנה at-rest: ברירת מחדל של Supabase. TLS in-transit דרך URL.

## MFA לחשבונות אנושיים ולסשן באפליקציה

GitHub, Vercel, Supabase dashboard — MFA חובה. אין שימוש שוטף ב-root.

- **30 דקות** חוסר פעילות בדשבורד → התנתקות. כניסה מחדש בסיסמה / Google / Microsoft.
- **20 יום** זכירת מכשיר (`lg_mfa_trust`): בלי גורם שני באותו דפדפן.
- אחרי 20 יום: מנהל — TOTP באפליקציה; מדריך — קוד SMS.
- התנתקות יזומה לא מוחקת את זכירת המכשיר (רק את סשן הסיסמה).

## מבדק חדירות

לפני חוזה עירייה / עלייה משמעותית: PT חיצוני.

תרחיש חובה: מדריך א' מנסה `GET /api/landings/{id-של-ב}/registrations` ו-`GET /api/learners/{user-של-ב}` — חייב 403.

הבדיקות ב-`scripts/security-checks.test.ts` הן חוזה יחידות, לא תחליף ל-PT.
