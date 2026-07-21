-- Migrate sector_kind -> haredi / east_jerusalem / general
-- Run the WHOLE script in one go in Supabase SQL Editor.
--
-- Existing sector values are cleared (old enum values do not map).

begin;

-- 1) Drop the dependent view first (required before altering landings.sector)
drop view if exists public.landings_with_like_count cascade;

-- 2) Ensure the new enum exists (safe to re-run after a partial attempt)
do $$ begin
  create type public.sector_kind_v2 as enum ('haredi', 'east_jerusalem', 'general');
exception when duplicate_object then null;
end $$;

-- 3) Move column off the old enum (clear incompatible values)
alter table public.landings
  alter column sector drop default;

alter table public.landings
  alter column sector type text using null;

alter table public.landings
  alter column sector type public.sector_kind_v2 using null;

-- 4) Replace old enum type name with the new one
--    (only works after no columns use sector_kind anymore)
drop type if exists public.sector_kind;
alter type public.sector_kind_v2 rename to sector_kind;

-- 5) Recreate the aggregate view used by GET /api/landings
create view public.landings_with_like_count as
select
  l.*,
  coalesce((select count(*) from public.likes lk where lk.landing_id = l.id), 0) as likes_count
from public.landings l;

commit;
