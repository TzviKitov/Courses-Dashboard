-- =====================================================================
-- Admin schema (Wave 3+) — run after schema.sql
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---- Admin helper (reads role from JWT app_metadata)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ---- Event types for usage tracking
do $$ begin
  create type usage_event_type as enum (
    'banner_start',
    'banner_success',
    'banner_error',
    'landing_created'
  );
exception when duplicate_object then null; end $$;

-- ---- landing_views --------------------------------------------------
create table if not exists public.landing_views (
  id uuid primary key default uuid_generate_v4(),
  landing_id text not null references public.landings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  viewer_key text not null,
  user_id uuid references auth.users(id) on delete set null
);

create index if not exists landing_views_landing_idx on public.landing_views (landing_id);
create index if not exists landing_views_viewed_at_idx on public.landing_views (viewed_at desc);

-- Per-day dedup index: stored generated column (UTC date) avoids IMMUTABLE errors on (viewed_at::date).
alter table public.landing_views
  add column if not exists viewed_date_utc date
  generated always as (((viewed_at at time zone 'UTC')::date)) stored;

drop index if exists public.landing_views_viewer_day_idx;
create index if not exists landing_views_viewer_day_idx
  on public.landing_views (landing_id, viewer_key, viewed_date_utc);

-- ---- usage_events ---------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default uuid_generate_v4(),
  event_type usage_event_type not null,
  user_id uuid references auth.users(id) on delete set null,
  landing_id text references public.landings(id) on delete set null,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_type_idx on public.usage_events (event_type);
create index if not exists usage_events_user_idx on public.usage_events (user_id);
create index if not exists usage_events_created_at_idx on public.usage_events (created_at desc);

-- ====================================================================
-- Row Level Security
-- ====================================================================

alter table public.landing_views enable row level security;
alter table public.usage_events enable row level security;

-- landings: admin full access (in addition to owner policies)
drop policy if exists landings_admin_select on public.landings;
create policy landings_admin_select on public.landings
  for select using (public.is_admin());

drop policy if exists landings_admin_update on public.landings;
create policy landings_admin_update on public.landings
  for update using (public.is_admin());

drop policy if exists landings_admin_delete on public.landings;
create policy landings_admin_delete on public.landings
  for delete using (public.is_admin());

-- registrations: admin read all
drop policy if exists registrations_admin_read on public.registrations;
create policy registrations_admin_read on public.registrations
  for select using (public.is_admin());

-- landing_views: inserts via service role only; admins can read
drop policy if exists landing_views_admin_read on public.landing_views;
create policy landing_views_admin_read on public.landing_views
  for select using (public.is_admin());

-- usage_events: inserts via service role only; admins can read
drop policy if exists usage_events_admin_read on public.usage_events;
create policy usage_events_admin_read on public.usage_events
  for select using (public.is_admin());
