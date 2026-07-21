-- =====================================================================
-- Dashboard schema (Wave 1)
-- Run in Supabase SQL Editor after creating the project.
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---- Extensions
create extension if not exists "uuid-ossp";

-- ---- Custom types (idempotent)
do $$ begin
  create type target_audience_tag as enum (
    'youth', 'young_adults', 'adults', 'seniors',
    'parents', 'professionals', 'students', 'general'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type sector_kind as enum (
    'haredi', 'east_jerusalem', 'general'
  );
exception when duplicate_object then null; end $$;

-- ---- landings -------------------------------------------------------
create table if not exists public.landings (
  id text primary key,
  course jsonb not null,
  assets jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  form jsonb not null default '{}'::jsonb,
  owner_id uuid references auth.users(id) on delete set null,
  is_public boolean not null default true,
  start_date date,
  price numeric(10, 2),
  sector sector_kind,
  target_audience_tags target_audience_tag[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landings_is_public_idx on public.landings (is_public);
create index if not exists landings_owner_idx on public.landings (owner_id);
create index if not exists landings_start_date_idx on public.landings (start_date);
create index if not exists landings_sector_idx on public.landings (sector);
create index if not exists landings_created_at_idx on public.landings (created_at desc);
create index if not exists landings_audience_tags_idx on public.landings using gin (target_audience_tags);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists landings_set_updated_at on public.landings;
create trigger landings_set_updated_at
  before update on public.landings
  for each row execute function public.set_updated_at();

-- ---- likes ----------------------------------------------------------
create table if not exists public.likes (
  landing_id text not null references public.landings(id) on delete cascade,
  identity text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (landing_id, identity)
);

create index if not exists likes_landing_idx on public.likes (landing_id);

-- Aggregate view used by GET /api/landings
create or replace view public.landings_with_like_count as
select
  l.*,
  coalesce((select count(*) from public.likes lk where lk.landing_id = l.id), 0) as likes_count
from public.landings l;

-- ---- registrations -------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default uuid_generate_v4(),
  landing_id text not null references public.landings(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  referral text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists registrations_landing_idx on public.registrations (landing_id);
create index if not exists registrations_created_at_idx on public.registrations (created_at desc);

-- ====================================================================
-- Row Level Security
-- ====================================================================

alter table public.landings enable row level security;
alter table public.likes enable row level security;
alter table public.registrations enable row level security;

-- landings: public can read is_public=true; owners can read/update/delete their own.
drop policy if exists landings_public_read on public.landings;
create policy landings_public_read on public.landings
  for select using (is_public = true);

drop policy if exists landings_owner_read on public.landings;
create policy landings_owner_read on public.landings
  for select using (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists landings_owner_update on public.landings;
create policy landings_owner_update on public.landings
  for update using (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists landings_owner_delete on public.landings;
create policy landings_owner_delete on public.landings
  for delete using (auth.uid() is not null and owner_id = auth.uid());

-- Inserts happen via service role (server side) - no INSERT policy here.

-- likes: anyone can read aggregates (via view); anyone can insert exactly one row per identity per landing.
drop policy if exists likes_public_read on public.likes;
create policy likes_public_read on public.likes for select using (true);

drop policy if exists likes_public_insert on public.likes;
create policy likes_public_insert on public.likes for insert with check (true);

drop policy if exists likes_self_delete on public.likes;
create policy likes_self_delete on public.likes for delete using (
  (auth.uid() is not null and user_id = auth.uid())
  or identity = current_setting('request.jwt.claims', true)::jsonb->>'anon_id'
);

-- registrations: writes happen via service role from API; owners can read registrations for their courses.
drop policy if exists registrations_owner_read on public.registrations;
create policy registrations_owner_read on public.registrations
  for select using (
    exists (
      select 1 from public.landings l
      where l.id = registrations.landing_id
        and l.owner_id = auth.uid()
    )
  );
