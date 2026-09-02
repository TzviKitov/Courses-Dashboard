# Supabase Setup (Out-of-Code Steps)

This guide covers the manual setup required for the dashboard implementation plan. Code changes assume these steps are completed.

## 1. Create Supabase Project

1. Go to <https://supabase.com/> and create a new project (free tier is fine for MVP).
2. Pick a region in the **EU** (required for this project: `eu-central-1` / Frankfurt). Do not use US regions.
3. Copy the project URL and the `anon` / `service_role` keys from **Project Settings -> API**.
4. Enable **MFA (TOTP)** in Authentication settings. Set minimum password length to **10**.
5. Database: SSL is required (`sslmode=require` is implied by the HTTPS URL). Enable PITR on a paid plan when going live.
6. **Do not set `APPS_SCRIPT_URL`.** Legacy Google Sheets mirroring is removed.

## 2. Environment Variables

Copy `.env.example` to `.env.local` (do **not** commit) and fill:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server only!
MFA_TRUST_SECRET=...            # HMAC for 20-day device trust cookie (optional; falls back to service role)
SUPABASE_STORAGE_BUCKET=course-media
USE_SUPABASE_DB=false           # flip to true after Wave 1 migration
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com   # required for OAuth redirects
```

Add the same variables to **Vercel -> Project Settings -> Environment Variables** (Production, Preview, Development). `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## 3. Storage Bucket (Wave 0)

1. **Storage -> New bucket** -> name: `course-media` -> **Public bucket: yes**.
2. (Optional) Set bucket file size limit to e.g. 5 MB and allowed mime types to `image/webp,image/png,image/jpeg`.

Bucket layout used by the code:

```text
course-media/
  tmp/{sessionId}/banner-full.webp
  tmp/{sessionId}/banner-thumb.webp
  tmp/{sessionId}/hero-full.webp
  tmp/{sessionId}/hero-thumb.webp
  courses/{landingId}/banner-full.webp
  courses/{landingId}/banner-thumb.webp
  courses/{landingId}/hero-full.webp
  courses/{landingId}/hero-thumb.webp
```

The `tmp/` prefix is used during banner generation; on landing creation, files are moved to `courses/{landingId}/`.

## 4. Database Schema (Wave 1)

In **SQL Editor**, run the contents of `db/schema.sql`. It creates:

- `landings` - one row per landing page (course data + assets URLs + metadata for filtering).
- `likes` - one row per like (anonymous via cookie or authenticated user).
- `registrations` - one row per registration (used in Wave 3).

It also sets up Row Level Security policies:

- **landings**: `is_public=true` rows are readable by anyone; writes require service role (or owner once Auth is enabled in Wave 3).
- **likes**: anyone can insert; aggregate reads are public.
- **registrations**: inserts via authenticated API with app rate limits; reads require owner/co-instructor/admin (RLS + API). Sensitive notes are a separate column set.

After running, flip `USE_SUPABASE_DB=true` in `.env.local`.

## 5. Migrate Existing JSON Landings (Wave 0/1)

Run the one-shot migration script after schema is in place:

```bash
npm run migrate:landings
```

It does the following for each `data/landings/*.json`:

1. If `assets.bannerUrl` or `assets.backgroundUrl` is a `data:image/...;base64,...` or a `blob:` URL, decode/skip and upload a placeholder note (the actual image is unrecoverable for `blob:` URLs; `base64` ones are uploaded).
2. Upload to `course-media/courses/{id}/banner-full.webp` and `hero-full.webp` (with `thumb` variants).
3. Insert the landing into Supabase `landings` table.
4. Print a summary of what was migrated and what was skipped (e.g. `447ijtfs.json` which only has a stale `blob:` URL).

The 1.5 MB file `pmr533t9.json` is treated specially: its base64 is decoded and uploaded; if you no longer need it, delete the JSON file after the script confirms upload.

## 6. Auth (Wave 3, Optional Until Then)

1. **Authentication -> Providers -> Google**: enable.
2. In Google Cloud Console, create an OAuth 2.0 Client; add the Supabase callback URL shown in the provider screen.
3. Paste `Client ID` and `Client Secret` into Supabase.
4. **Authentication -> URL Configuration** — add **Site URL** and **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (local dev)
   - `https://your-production-domain.com/auth/callback` (production)
   - If you use Vercel preview deployments, add each preview origin too, e.g. `https://your-app-*.vercel.app/auth/callback` or the specific preview URL.
5. Set **`NEXT_PUBLIC_BASE_URL`** in Vercel to your canonical production URL (no trailing slash). The app uses this for OAuth `redirectTo`; if it points to the wrong domain, Google sign-in completes but session cookies are not stored on the site you are browsing.
6. After changing env vars or Supabase URL settings, redeploy and test: sign in via **הקורסים שלי**, then confirm the nav shows your email and **התנתק** (not **התחבר**). In DevTools → Network, the `/auth/callback` response should include `Set-Cookie` headers for `sb-*-auth-token`.

## 6b. Admin schema and roles

After `schema.sql`, run **`db/schema-admin.sql`** in the SQL Editor. It adds:

- `landing_views` — page view tracking for `/l/[id]` (includes generated `viewed_date_utc` for per-day dedup index)
- `usage_events` — banner/Gemini and landing-creation events
- `is_admin()` — RLS helper reading `app_metadata.role` from the JWT

If an earlier run failed on `(viewed_at::date)` index, re-run the full file — it is idempotent and replaces that index with `viewed_date_utc`.

### Grant admin access

1. Supabase → **Authentication → Users** → select a user.
2. Under **App Metadata** (raw JSON), set: `{ "role": "admin" }`
3. The user must **sign out and sign in again** so the JWT picks up the new role.
4. In the app, open **ניהול** (`/dashboard/admin`) from the dashboard nav.

Non-admins are redirected away from `/dashboard/admin` and receive `403` from `/api/admin/*`.

## 8. Follow-ups (registrants, forms, email)

In **SQL Editor**, run `db/schema-followups.sql` (after schema.sql + schema-admin.sql). It adds:

- `landings.end_date`
- Extended `registrations` columns (instructor notes, cancel soft-delete, forms 1–3 fields)
- `landing_followups`, `registration_attachments`, `form_access_tokens`, `email_outbox`

### Storage bucket for registrant files

1. **Storage → New bucket** → name: `registration-files` → **Public: no** (private).
2. Allow mime types: `application/pdf,image/jpeg,image/png`, max ~10 MB.

### Email (Resend) + cron

Add to `.env.local` / Vercel:

```ini
RESEND_API_KEY=re_...
EMAIL_FROM="קורסים <noreply@your-verified-domain.com>"
CRON_SECRET=long-random-string
SECURITY_ALERT_EMAIL=
FORMS_REQUIRE_AUTH=false
```

- `FORMS_REQUIRE_AUTH=true` disables magic-link token pages (`/f/...`) — instructors must use the logged-in dashboard.
- Cron: `vercel.json` schedules `GET /api/cron/followups` daily. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.

## 9. Vercel Configuration

- Project Settings -> Functions: `app/api/banner/**` runs with `maxDuration=60` (also set in code via `export const maxDuration = 60`).
- Verify in Logs that banner generation stays well under 60s; otherwise consider upgrading to Pro for 300s.
- Cron job for follow-up emails is defined in `vercel.json` (`/api/cron/followups`). Set `CRON_SECRET` in project env.
- Daily security cron: `/api/cron/security` (prune audit after 24 months, rate-limit rows, anomaly email).
- **Preview isolation:** Preview deployments must use a **separate** Supabase project. Never point Preview env at production keys. Never copy real minor PII into staging/preview. See `docs/privacy/OPS.md`.

## 10. User management (profiles, instructors, students)

After `schema.sql` + `schema-admin.sql` (+ followups if used), run **`db/schema-profiles.sql`** in the SQL Editor. It creates:

- `profiles` — role (`student` | `instructor` | `admin`), status (`pending` | `active` | `disabled`), `can_view_all_learners`
- `instructor_email_allowlist` — Microsoft auto-approve emails (managed in Admin → Users)
- `landing_instructors` — co-instructors on a course
- `registrations.user_id` — link course registration to a site user
- Backfill: existing `auth.users` → active instructors (admins keep admin)

App metadata is synced on role changes: `{ "role": "...", "status": "..." }`. Users should re-login after bulk SQL backfill so the JWT refreshes.

Then run **`db/schema-privacy.sql`**. It adds organizations (nullable tenancy), audit_events (24-month retention), rate_limit_events, data_requests, registration birth_year/parent/marketing fields, and capability flags (`can_export_registrants`, `can_view_sensitive_notes`, `can_export_sensitive_notes`).

Remove `APPS_SCRIPT_URL` from Vercel if present.

### Email / password for instructors

1. Supabase → **Authentication → Providers → Email**: enable.
2. Set password requirements in Auth settings to match the app (10+ chars, upper, lower, digit, special).
3. **Confirm email** — keep **enabled** in production for instructor self-signup.
   - It only proves the mailbox is real (typo / someone using another person’s address).
   - It does **not** grant instructor rights; Admin approval still required (`pending` → `active`).
   - After confirm, login is **email + password** (or Google/Microsoft on an existing account).
   - Students on course forms use **SMS OTP** (or OAuth) — Confirm email does not apply to them.
   - Admin invite already sets `email_confirm: true` and sends a Hebrew set-password mail via Resend.
4. Instructor self-signup: `/auth/register` → confirm mail → `/auth/pending` until Admin approves.
5. Admin invite: Admin → Users → הזמנת מדריך (Hebrew mail via Resend).

#### Hebrew Confirm signup template (Supabase Auth)

Supabase → **Authentication → Email Templates → Confirm signup**.
Set subject and body (HTML) to something like:

**Subject:** אימות מייל — CourseFlow

**Body:**

```html
<h2>שלום {{ .Data.display_name }}</h2>
<p>קיבלנו בקשה להרשמת מדריך ב־CourseFlow.</p>
<p>כדי לאמת שכתובת המייל שלך תקינה, לחץ/י על הקישור:</p>
<p><a href="{{ .ConfirmationURL }}">אימות המייל והמשך להרשמה</a></p>
<p>אם לא ביקשת להירשם — אפשר להתעלם מהודעה זו.</p>
```

Also set **Authentication → Emails** sender name if using custom SMTP (recommended: same domain as `EMAIL_FROM` / Resend). Without custom SMTP, Supabase’s default sender is used but the template text above still applies.

### Microsoft (Azure) for instructors

Two registration models (pick one):

| Model | When | Azure “Supported account types” | Supabase **Azure Tenant URL** |
|-------|------|----------------------------------|-------------------------------|
| **A. Multi-tenant (typical if you have no org IT rights)** | App registered in **your personal** Azure / Default Directory; instructors sign in with **their** work Microsoft accounts | **Accounts in any organizational directory** (Multitenant). Optional: also personal Microsoft accounts | Leave empty / default, or set `https://login.microsoftonline.com/organizations` (work/school only) or `https://login.microsoftonline.com/common` |
| **B. Single-tenant (org-owned app)** | App registered **inside the department Entra tenant** by IT | **My organization only** | `https://login.microsoftonline.com/{tenant-id}` |

**Do not** use single-tenant + your personal Default Directory + a work email from another org — Microsoft will error that the user is not in that tenant (exactly: “אינו קיים בדייר Default Directory”).

App access is still gated in CourseFlow by the **Microsoft instructor allowlist** (Admin → Users), not by Azure alone.

1. Supabase → **Authentication → Providers → Azure**: enable with Client ID/Secret from the Entra app registration.
2. Match Tenant URL to the table above.
3. Add department emails in **Admin → Users → Allowlist Microsoft**. Only those emails auto-become active instructors (no admin approval).
4. Google does **not** create new instructors; it can log in / link existing approved accounts. Students may use Google freely on course registration.

#### Fix if you already created a personal single-tenant app

1. Azure Portal → **App registrations** → your app → **Authentication** (or **Manifest**).
2. Change supported accounts to **Multitenant**  
   (`signInAudience`: `AzureADMultipleOrgs`, or `AzureADandPersonalMicrosoftAccount` if you also want MSA).
3. Supabase Azure provider: set Tenant URL to  
   `https://login.microsoftonline.com/organizations`  
   (or clear it so Supabase uses `common`).
4. Retry Microsoft login with the organizational account.
5. First login from a locked-down org may still show **Need admin approval** — that requires their IT once; otherwise allowlist + multi-tenant is enough.

### Phone SMS (students + instructor second factor)

- **Students:** SMS OTP for course registration (Supabase Phone provider + Auth Hook).
- **Instructors:** app-issued 6-digit SMS after password/OAuth (table `mfa_otp_challenges`). Not TOTP.
- **Admins:** TOTP authenticator app; SMS is not used.

Integrated provider: **Global SMS** SOAP over HTTPS  
(`https://sapi.itnewsletter.co.il/webservices/wssms.asmx`).

Global SMS support directed Vercel / dynamic-IP hosts to this **sapi** endpoint
instead of the REST host that requires IP whitelist. No Vercel Static IPs required
for this path.

1. Supabase → **Authentication → Providers → Phone**: enable.
2. Configure **Auth Hook → Send SMS** to:

   `https://your-domain.com/api/auth/sms-hook`

   Click **Generate secret** in Supabase (format `v1,whsec_...`). Put the **exact same
   value** in `SMS_HOOK_SECRET` (Vercel + `.env.local`). Auth uses Standard Webhooks —
   a random Bearer string will not work.

3. In Global SMS account:
   - Complete **KYC** (required for API in Israel)
   - Generate **Api Access Key** → `SMS_PROVIDER_TOKEN`
   - Approve **originator** (sender number/name) in Send Sms screen → `SMS_ORIGINATOR`

4. Env vars:

```ini
SMS_HOOK_SECRET=v1,whsec_xxxxxxxx
SMS_PROVIDER_URL=https://sapi.itnewsletter.co.il/webservices/wssms.asmx
SMS_PROVIDER_TOKEN=your-globalsms-api-key
SMS_ORIGINATOR=0521234567
SMS_ISRAEL_ONLY=true
```

5. Without `SMS_PROVIDER_TOKEN`, the hook logs OTP to server logs (dev only).
6. App sends destinations in local format `05XXXXXXXX`; enforces Israeli mobiles before OTP.
7. SMS body (from the hook): `CourseFlow: קוד אימות להרשמה או התחברות: {otp}`

### Admin capabilities

- `/dashboard/admin/users` — approve/disable/delete users, invite, allowlist, grant `can_view_all_learners`
- `/dashboard/admin/courses` — add / replace course instructors (`owner_id` + `landing_instructors`)
- Delete user transfers their landings to the acting admin

### Learner cross-course view

`GET /api/learners/[userId]` — admin always; instructor only if `can_view_all_learners` **and** the learner registered to at least one of the instructor’s courses.

