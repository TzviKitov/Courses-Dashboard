# מעבדי נתונים / ספקים

חובה DPA מול כל אחד לפני ייצור עם נתוני אמת של קטינים. טיוטה — עו"ד מאשר.

| ספק | תפקיד | מידע | אזור יעד | DPA |
|---|---|---|---|---|
| Supabase | DB, Auth, Storage | כל המאגר | EU (`eu-central-1`) | [supabase.com/legal](https://supabase.com/legal) |
| Vercel | Hosting, cron, לוגים | בקשות HTTP, env | EU אם מוגדר Frankfurt | [vercel.com/legal](https://vercel.com/legal) |
| Resend | אימייל | כתובות + תוכן מייל | לבדוק בחשבון | כן |
| Google | OAuth + Gemini (באנר קורס בלבד) | אימייל/שם OAuth; טקסט קורס ל-Gemini | מחוץ לישראל אפשרי | כן; לא לשלוח PII נרשמים ל-Gemini |
| Microsoft | OAuth מדריכים | אימייל/שם | Azure tenant | כן |
| Global SMS | OTP | מספר טלפון + קוד | ישראל | חוזה ספק |

**נעילת region:** פרויקט Supabase ב-EU בלבד. Preview של Vercel — פרויקט Supabase נפרד (staging), בלי נתוני אמת.

**CLOUD Act:** ספקים אמריקאיים עשויים להיות כפופים לדין ארה"ב גם אם השרת ב-EU. לתעד במסמך הגדרות ובסיס משפטי להעברה.
