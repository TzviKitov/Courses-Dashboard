-- =====================================================================
-- Brand logos library (admin-managed)
-- Run after schema.sql. Idempotent: safe to re-run.
-- =====================================================================

create table if not exists public.brand_logos (
  id text primary key,
  name text not null,
  url text not null,
  storage_path text,
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_logos_sort_idx
  on public.brand_logos (sort_order, name);

drop trigger if exists brand_logos_set_updated_at on public.brand_logos;
create trigger brand_logos_set_updated_at
  before update on public.brand_logos
  for each row execute function public.set_updated_at();

alter table public.brand_logos enable row level security;

-- Public catalog: instructors pick logos during course creation.
drop policy if exists brand_logos_public_read on public.brand_logos;
create policy brand_logos_public_read on public.brand_logos
  for select using (true);

-- Writes go through the service role (admin API). No insert/update/delete policies.

-- Seed the existing static catalog. URLs stay under /brand/logos/ until
-- an admin replaces an entry with an uploaded file.
insert into public.brand_logos (id, name, url, tags, sort_order)
values
  ('irya', 'עיריית ירושלים', '/brand/logos/irya.png', array['עירייה', 'ירושלים'], 10),
  ('minhal', 'מנהל חינוך', '/brand/logos/minhal.png', array['חינוך', 'מנהל'], 20),
  ('hinoch', 'אגף החינוך', '/brand/logos/hinoch.png', array['חינוך', 'אגף'], 30),
  ('kidom', 'קידום נוער', '/brand/logos/kidom.png', array['נוער', 'קידום'], 40),
  ('revaha', 'רווחה', '/brand/logos/revaha.png', array['רווחה', 'שירותים'], 50),
  ('hila', 'הילה', '/brand/logos/hila.png', array['הילה', 'תוכנית'], 60),
  ('leomit', 'לאומית', '/brand/logos/leomit.png', array['לאומית', 'ביטוח'], 70),
  ('moza', 'מוצא', '/brand/logos/moza.png', array['מוצא', 'מרכז'], 80),
  ('maane', 'מענה', '/brand/logos/maane.png', array['מענה', 'שירות'], 90),
  ('makbatz', 'מקבץ', '/brand/logos/makbatz.png', array['מקבץ', 'קהילה'], 100),
  ('mentoring', 'מנטורינג', '/brand/logos/mentoring.png', array['מנטורינג', 'הכשרה'], 110)
on conflict (id) do nothing;
