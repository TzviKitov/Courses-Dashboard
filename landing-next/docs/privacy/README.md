# תיעוד פרטיות ואבטחה — CourseFlow

טיוטות הנדסיות. **אינן ייעוץ משפטי.** יש לאשר מול עורך דין המתמחה בהגנת פרטיות בישראל.

| מסמך | תוכן |
|---|---|
| [DATA_INVENTORY.md](./DATA_INVENTORY.md) | מלאי שדות וזרימת מידע |
| [PROCESSORS.md](./PROCESSORS.md) | מעבדים, region, CLOUD Act |
| [OPS.md](./OPS.md) | סביבות, PITR, MFA אנושי, מבדק חדירות |
| [PT_SCENARIO.md](./PT_SCENARIO.md) | תרחיש PT: מדריך א' → נער של מדריך ב' |
| [RESTORE_DRILL.md](./RESTORE_DRILL.md) | תבנית דוח שחזור שנתי |
| [DPIA.md](./DPIA.md) | הערכת השפעה — קטינים + הערות רגשיות |
| [LEGAL_TEMPLATES.md](./LEGAL_TEMPLATES.md) | הגדרות מאגר, נוהל אבטחה, אירוע, NDA, DPA |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | תסריט אירוע מפורט |

## הפעלה בפרודקשן

1. להריץ `landing-next/db/schema-privacy.sql` אחרי `schema-profiles.sql`.
2. למחוק `APPS_SCRIPT_URL` מ-Vercel (אם קיים).
3. Preview של Vercel — פרויקט Supabase **נפרד**, בלי נתוני אמת של קטינים.
4. להפעיל MFA TOTP ב-Supabase Auth (למנהלים); סיסמה מינימלית 10. מדריכים משתמשים ב-SMS OTP של האפליקציה, לא ב-TOTP.
5. PITR בתוכנית בתשלום + תרגיל restore שנתי.
6. לאשר מדיניות פרטיות (`/privacy`) מול עו"ד לפני הרחבת קהל.
