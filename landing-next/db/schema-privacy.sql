-- =====================================================================
-- Privacy / security layer (rate limits, audit, orgs, sensitive flags)
-- Run after schema-profiles.sql. Idempotent: safe to re-run.
-- =====================================================================

-- ---- Organizations (nullable tenancy; existing rows stay on default org)
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'ברירת מחדל', 'default')
on conflict (id) do nothing;

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists can_export_registrants boolean not null default true,
  add column if not exists can_view_sensitive_notes boolean not null default true,
  add column if not exists can_export_sensitive_notes boolean not null default false,
  add column if not exists last_seen_at timestamptz;

-- Platform admin: no sensitive notes / export of notes by default
update public.profiles
set can_view_sensitive_notes = false,
    can_export_sensitive_notes = false
where role = 'admin'
  and can_view_sensitive_notes is not false;

alter table public.landings
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

update public.profiles
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

update public.landings
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

-- ---- Registration privacy fields
alter table public.registrations
  add column if not exists birth_year integer,
  add column if not exists parent_name text,
  add column if not exists parent_phone text,
  add column if not exists parent_consent_at timestamptz,
  add column if not exists marketing_opt_in boolean not null default false;

-- ---- Rate limit events (hashed key; append-only; cron prunes)
create table if not exists public.rate_limit_events (
  id uuid primary key default uuid_generate_v4(),
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (bucket, key_hash, created_at desc);

alter table public.rate_limit_events enable row level security;
-- No policies: service role only.

-- ---- Audit events (append-only for app roles)
create table if not exists public.audit_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  ip_address text,
  user_agent text,
  result text not null default 'ok',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_events_created_idx
  on public.audit_events (created_at desc);
create index if not exists audit_events_actor_idx
  on public.audit_events (actor_id, created_at desc);
create index if not exists audit_events_action_idx
  on public.audit_events (action, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_admin_select on public.audit_events;
create policy audit_events_admin_select on public.audit_events
  for select using (public.is_admin());

-- Block updates/deletes from authenticated users (service role bypasses RLS)
drop policy if exists audit_events_no_update on public.audit_events;
create policy audit_events_no_update on public.audit_events
  for update using (false);

drop policy if exists audit_events_no_delete on public.audit_events;
create policy audit_events_no_delete on public.audit_events
  for delete using (false);

-- ---- Data subject requests (sections 13–14)
create table if not exists public.data_requests (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  request_type text not null check (request_type in ('access', 'rectify', 'erase', 'other')),
  full_name text not null,
  email text,
  phone text,
  details text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'rejected')),
  handled_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null,
  notes text
);

create index if not exists data_requests_status_idx
  on public.data_requests (status, created_at desc);

alter table public.data_requests enable row level security;

drop policy if exists data_requests_admin_all on public.data_requests;
create policy data_requests_admin_all on public.data_requests
  for all using (public.is_admin());

-- Public insert goes through service role API only.

-- ---- Instructor SMS MFA challenges (hashed OTP; service role only)
create table if not exists public.mfa_otp_challenges (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.mfa_otp_challenges enable row level security;

-- ---- Org-aware landing management (additive: null org skips the check)
create or replace function public.same_organization(a uuid, b uuid)
returns boolean
language sql
stable
as $$
  select a is null or b is null or a = b;
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
      left join public.profiles p on p.id = auth.uid()
      where l.id = p_landing_id
        and l.owner_id = auth.uid()
        and public.same_organization(l.organization_id, p.organization_id)
    )
    or exists (
      select 1
      from public.landing_instructors li
      join public.landings l on l.id = li.landing_id
      left join public.profiles p on p.id = auth.uid()
      where li.landing_id = p_landing_id
        and li.user_id = auth.uid()
        and public.same_organization(l.organization_id, p.organization_id)
    );
$$;

alter table public.organizations enable row level security;
drop policy if exists organizations_admin_all on public.organizations;
create policy organizations_admin_all on public.organizations
  for all using (public.is_admin());
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = organizations.id
    )
  );
