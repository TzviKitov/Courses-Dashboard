-- =====================================================================
-- Profiles / roles / course instructors (user management)
-- Run after schema.sql + schema-admin.sql (+ followups optional).
-- Idempotent: safe to re-run.
-- =====================================================================

create extension if not exists "citext";

-- ---- profiles -------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student'
    check (role in ('student', 'instructor', 'admin')),
  status text not null default 'active'
    check (status in ('pending', 'active', 'disabled')),
  can_view_all_learners boolean not null default false,
  phone text,
  created_via text
    check (created_via is null or created_via in (
      'email', 'phone', 'google', 'azure', 'admin_invite'
    )),
  requested_all_learners_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_status_idx
  on public.profiles (role, status);
create index if not exists profiles_requested_learners_idx
  on public.profiles (requested_all_learners_at)
  where requested_all_learners_at is not null;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---- Microsoft instructor allowlist --------------------------------
create table if not exists public.instructor_email_allowlist (
  email citext primary key,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---- Extra instructors on a landing --------------------------------
create table if not exists public.landing_instructors (
  landing_id text not null references public.landings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (landing_id, user_id)
);

create index if not exists landing_instructors_user_idx
  on public.landing_instructors (user_id);

-- ---- Link registrations to site users ------------------------------
alter table public.registrations
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists registrations_user_idx
  on public.registrations (user_id);

-- ---- Helpers --------------------------------------------------------
create or replace function public.is_active_instructor()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('instructor', 'admin')
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'status', 'active') = 'active',
    false
  );
$$;

create or replace function public.can_manage_landing(p_landing_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.landings l
      where l.id = p_landing_id and l.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.landing_instructors li
      where li.landing_id = p_landing_id and li.user_id = auth.uid()
    );
$$;

-- ---- RLS ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.instructor_email_allowlist enable row level security;
alter table public.landing_instructors enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Profile mutations (role/status/flags) go through service-role admin APIs only.
drop policy if exists profiles_update_own_limited on public.profiles;

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin());

drop policy if exists allowlist_admin_all on public.instructor_email_allowlist;
create policy allowlist_admin_all on public.instructor_email_allowlist
  for all using (public.is_admin());

drop policy if exists landing_instructors_select on public.landing_instructors;
create policy landing_instructors_select on public.landing_instructors
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or public.can_manage_landing(landing_id)
  );

drop policy if exists landing_instructors_admin_write on public.landing_instructors;
create policy landing_instructors_admin_write on public.landing_instructors
  for all using (public.is_admin());

-- Owners + co-instructors can read registrations (extends owner policy)
drop policy if exists registrations_instructor_read on public.registrations;
create policy registrations_instructor_read on public.registrations
  for select using (public.can_manage_landing(landing_id));

-- Students can read their own registration rows
drop policy if exists registrations_self_read on public.registrations;
create policy registrations_self_read on public.registrations
  for select using (user_id = auth.uid());

-- ---- Backfill existing auth users as active instructors ------------
insert into public.profiles (id, display_name, role, status, created_via)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  case
    when coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin' then 'admin'
    else 'instructor'
  end,
  'active',
  case
    when u.raw_app_meta_data ->> 'provider' = 'azure' then 'azure'
    when u.raw_app_meta_data ->> 'provider' = 'google' then 'google'
    else 'google'
  end
from auth.users u
on conflict (id) do nothing;

-- Sync app_metadata.role/status for JWT + is_admin()
-- (run once; ongoing sync happens in app code via service role)
do $$
declare
  r record;
begin
  for r in
    select id, role, status from public.profiles
  loop
    update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', r.role, 'status', r.status)
    where id = r.id;
  end loop;
end $$;
