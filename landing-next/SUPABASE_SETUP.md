# Supabase Setup (Out-of-Code Steps)

This guide covers the manual setup required for the dashboard implementation plan. Code changes assume these steps are completed.

## 1. Create Supabase Project

1. Go to <https://supabase.com/> and create a new project (free tier is fine for MVP).
2. Pick a region close to your users (e.g. `eu-central-1` for Israel/EU).
3. Copy the project URL and the `anon` / `service_role` keys from **Project Settings -> API**.

## 2. Environment Variables

Copy `.env.example` to `.env.local` (do **not** commit) and fill:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server only!
SUPABASE_STORAGE_BUCKET=course-media
USE_SUPABASE_DB=false           # flip to true after Wave 1 migration
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
- **registrations**: writes are open (rate limited in app); reads require service role / owner.

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
4. **Authentication -> URL Configuration**: add allowed redirect URLs (`http://localhost:3000/auth/callback`, production domain).

## 7. Vercel Configuration

- Project Settings -> Functions: `app/api/banner/**` runs with `maxDuration=60` (also set in code via `export const maxDuration = 60`).
- Verify in Logs that banner generation stays well under 60s; otherwise consider upgrading to Pro for 300s.
