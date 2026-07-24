-- =====================================================================
-- Follow-ups schema: registrants lifecycle, forms 1–3, email outbox
-- Run in Supabase SQL Editor after schema.sql.
-- Idempotent: safe to re-run.
-- =====================================================================

-- Admin helper (also in schema-admin.sql) — needed for RLS below.
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

-- ---- landings.end_date ----------------------------------------------
alter table public.landings
  add column if not exists end_date date;

create index if not exists landings_end_date_idx on public.landings (end_date);

-- Must DROP then recreate: CREATE OR REPLACE cannot rename/reorder columns
-- when landings gains end_date (likes_count would shift position).
drop view if exists public.landings_with_like_count;
create view public.landings_with_like_count as
select
  l.*,
  coalesce((select count(*) from public.likes lk where lk.landing_id = l.id), 0) as likes_count
from public.landings l;

-- ---- registrations extensions ---------------------------------------
alter table public.registrations
  add column if not exists instructor_notes text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists acceptance_status text,
  add column if not exists form1_notes text,
  add column if not exists form1_submitted_at timestamptz,
  add column if not exists completion_status text,
  add column if not exists form2_notes text,
  add column if not exists form2_submitted_at timestamptz,
  add column if not exists placement_status boolean,
  add column if not exists placement_where text,
  add column if not exists form3_feedback text,
  add column if not exists form3_notes text,
  add column if not exists form3_submitted_at timestamptz;

do $$ begin
  alter table public.registrations
    add constraint registrations_acceptance_status_check
    check (acceptance_status is null or acceptance_status in ('accepted', 'rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.registrations
    add constraint registrations_completion_status_check
    check (completion_status is null or completion_status in ('completed', 'dropped'));
exception when duplicate_object then null; end $$;

-- Owner can update their course registrations (service role still used by API)
drop policy if exists registrations_owner_update on public.registrations;
create policy registrations_owner_update on public.registrations
  for update using (
    exists (
      select 1 from public.landings l
      where l.id = registrations.landing_id
        and l.owner_id = auth.uid()
    )
  );

drop policy if exists registrations_admin_update on public.registrations;
create policy registrations_admin_update on public.registrations
  for update using (public.is_admin());

-- ---- landing_followups (course-level form 2 + 3) --------------------
create table if not exists public.landing_followups (
  landing_id text primary key references public.landings(id) on delete cascade,
  professionalism_rating int check (professionalism_rating is null or (professionalism_rating between 1 and 5)),
  audience_fit_rating int check (audience_fit_rating is null or (audience_fit_rating between 1 and 5)),
  audience_fit_text text,
  form2_notes text,
  form2_submitted_at timestamptz,
  general_feedback text,
  form3_notes text,
  form3_submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_followups_set_updated_at on public.landing_followups;
create trigger landing_followups_set_updated_at
  before update on public.landing_followups
  for each row execute function public.set_updated_at();

alter table public.landing_followups enable row level security;

drop policy if exists landing_followups_owner_read on public.landing_followups;
create policy landing_followups_owner_read on public.landing_followups
  for select using (
    exists (
      select 1 from public.landings l
      where l.id = landing_followups.landing_id
        and l.owner_id = auth.uid()
    )
  );

drop policy if exists landing_followups_owner_upsert on public.landing_followups;
create policy landing_followups_owner_upsert on public.landing_followups
  for insert with check (
    exists (
      select 1 from public.landings l
      where l.id = landing_followups.landing_id
        and l.owner_id = auth.uid()
    )
  );

drop policy if exists landing_followups_owner_update on public.landing_followups;
create policy landing_followups_owner_update on public.landing_followups
  for update using (
    exists (
      select 1 from public.landings l
      where l.id = landing_followups.landing_id
        and l.owner_id = auth.uid()
    )
  );

drop policy if exists landing_followups_admin_read on public.landing_followups;
create policy landing_followups_admin_read on public.landing_followups
  for select using (public.is_admin());

drop policy if exists landing_followups_admin_all on public.landing_followups;
create policy landing_followups_admin_all on public.landing_followups
  for all using (public.is_admin());

-- ---- registration_attachments ---------------------------------------
create table if not exists public.registration_attachments (
  id uuid primary key default uuid_generate_v4(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  landing_id text not null references public.landings(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists registration_attachments_reg_idx
  on public.registration_attachments (registration_id);
create index if not exists registration_attachments_landing_idx
  on public.registration_attachments (landing_id);

alter table public.registration_attachments enable row level security;

drop policy if exists registration_attachments_owner_read on public.registration_attachments;
create policy registration_attachments_owner_read on public.registration_attachments
  for select using (
    exists (
      select 1 from public.landings l
      where l.id = registration_attachments.landing_id
        and l.owner_id = auth.uid()
    )
  );

drop policy if exists registration_attachments_admin_read on public.registration_attachments;
create policy registration_attachments_admin_read on public.registration_attachments
  for select using (public.is_admin());

-- Writes via service role from API (no insert/update/delete policies for anon/auth).

-- ---- form_access_tokens ---------------------------------------------
do $$ begin
  create type form_access_type as enum ('open_pack', 'form1', 'form2', 'form3');
exception when duplicate_object then null; end $$;

create table if not exists public.form_access_tokens (
  id uuid primary key default uuid_generate_v4(),
  landing_id text not null references public.landings(id) on delete cascade,
  form_type form_access_type not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists form_access_tokens_landing_idx
  on public.form_access_tokens (landing_id, form_type);

alter table public.form_access_tokens enable row level security;
-- No policies: service role only.

-- ---- email_outbox ---------------------------------------------------
do $$ begin
  create type email_outbox_type as enum (
    'course_open',
    'form1',
    'form2',
    'form3',
    'reminder_course_open',
    'reminder_form1',
    'reminder_form2',
    'reminder_form3'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type email_outbox_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists public.email_outbox (
  id uuid primary key default uuid_generate_v4(),
  landing_id text not null references public.landings(id) on delete cascade,
  email_type email_outbox_type not null,
  recipient text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  reminder_of uuid references public.email_outbox(id) on delete set null,
  status email_outbox_status not null default 'pending',
  error text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox (status, scheduled_for)
  where status = 'pending';

create index if not exists email_outbox_landing_idx
  on public.email_outbox (landing_id, email_type);

-- One row per landing + type + recipient (primary or reminder)
create unique index if not exists email_outbox_unique
  on public.email_outbox (landing_id, email_type, recipient);

alter table public.email_outbox enable row level security;

drop policy if exists email_outbox_admin_read on public.email_outbox;
create policy email_outbox_admin_read on public.email_outbox
  for select using (public.is_admin());
