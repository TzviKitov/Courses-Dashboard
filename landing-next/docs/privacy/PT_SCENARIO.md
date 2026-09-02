# תרחיש מבדק חדירות (PT) — חובה לפני חוזה עירייה

לא כלי תקיפה בקוד הייצור. לבצע בסביבת staging עם חשבונות סינתטיים.

## תרחיש חובה: מדריך א' → נער של מדריך ב'

1. צור שני מדריכים פעילים (A, B) ושני קורסים.
2. הרשם נער סינתטי לקורס של B בלבד.
3. התחבר כ-A.
4. נסה:
   - `GET /api/landings/{id-של-B}/registrations` — חייב **403**
   - `GET /api/landings/{id-של-B}/registrations/{regId}/attachments?attachmentId=...` — חייב **403/404**
   - `GET /api/learners/{userId-של-הנער}` — חייב **403** אלא אם ל-A יש `can_view_all_learners` **וגם** קשר לקורס; גם אז הערות רגישות רק לקורסים של A
   - קישור קסם של טופס 1 של B בחשבון A — אסור
5. CSV: A מייצא את הקורס שלו בלי עמודות הערות כברירת מחדל.

## בדיקות יחידה מקומיות

`npm test` ב-`landing-next` מכסה stripping, org-scope, magic-bytes, open-redirect. זה **לא** תחליף ל-PT.
