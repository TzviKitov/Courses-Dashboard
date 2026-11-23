-- =====================================================================
-- Co-guide requests: a guide asks to invite another guide to a course.
-- An admin approves (the new guide gets an invite email if needed) or rejects.
-- Run in Supabase SQL Editor after schema-profiles.sql.
-- Idempotent: safe to re-run.
-- DO NOT run in production without explicit approval.
-- =====================================================================

create table if not exists public.co_guide_requests (
  id uuid primary key default uuid_generate_v4(),
  landing_id text not null references public.landings(id) on delete cascade,
  email citext not null,
  display_name text,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists co_guide_requests_status_idx
  on public.co_guide_requests (status, created_at desc);
create index if not exists co_guide_requests_landing_idx
  on public.co_guide_requests (landing_id);

-- One open request per course and email.
create unique index if not exists co_guide_requests_open_unique
  on public.co_guide_requests (landing_id, email)
  where status = 'pending';

-- Service role only (all access goes through the app's server APIs).
alter table public.co_guide_requests enable row level security;
