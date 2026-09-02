# מלאי מידע (CourseFlow)

מקור אמת: `landing-next/db/schema*.sql`. לעדכן כשמוסיפים שדה. אין שיקוף ל-Google Sheets (`APPS_SCRIPT_URL` בוטל).

## טבלאות וזרימה

| טבלה / שדה | רגישות | לאן זורם |
|---|---|---|
| landings.course/assets/theme | שיווקי | דף ציבורי, Gemini (תוכן קורס בלבד) |
| landings.sector, target_audience_tags | עלול להסיק שיוך | קורס, לא רשומת נער |
| landings.organization_id | תפעולי | בידוד עתידי |
| registrations.full_name, phone, email | PII | UI מדריך, CSV, אימייל תפעולי |
| registrations.birth_year, parent_* | PII / קטינים | טופס הרשמה, API נרשמים |
| registrations.marketing_opt_in | הסכמה 30א | דיוור; `/api/unsubscribe` |
| instructor_notes, form1/2/3_notes, form3_feedback | **רגישות מיוחדת** | UI מדריך (עם הרשאה), לא CSV כברירת מחדל, לא BI, לא Gemini |
| placement_* | תעסוקה | טפסים, CSV בלי הערות |
| registration_attachments | מסמכים | באקט פרטי, הורדה חתומה 60 שנ' |
| profiles (role, flags, org) | זהות + הרשאות | Auth JWT |
| landing_views.viewer_key | IP+UA מגובב | אנליטיקה |
| email_outbox.recipient | אימייל | Resend |
| form_access_tokens.token_hash | סוד מגובב | קישור קסם 14 יום |
| audit_events | יומן אבטחה | אדמין, שמירה 24 חודש, prune ב-cron |
| mfa_otp_challenges | hash של קוד SMS למדריך | שירות בלבד, TTL קצר |
| data_requests | בקשות זכויות | אדמין `/dashboard/admin/privacy` |
| rate_limit_events | מפתח מגובב | שירות בלבד |

**לא נשלח ל-Gemini:** שמות, טלפונים, הערות נרשמים, קבצי נרשמים.

**ייצוא CSV:** ברירת מחדל בלי עמודות הערות. עם הערות רק אם `can_export_sensitive_notes` + `notes=1`.
