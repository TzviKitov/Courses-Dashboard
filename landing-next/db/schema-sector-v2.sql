-- Migrate sector_kind from domain-based values to community-sector values.
-- Run once in Supabase SQL Editor on existing projects.
--
-- Old values (education/welfare/...) cannot map cleanly, so existing
-- sector values are cleared to NULL. New creates use haredi/east_jerusalem/general.

-- 0) Drop dependent view so the column type can change
drop view if exists public.landings_with_like_count;

-- 1) Add new enum
do $$ begin
  create type sector_kind_v2 as enum ('haredi', 'east_jerusalem', 'general');
exception when duplicate_object then null; end $$;

-- 2) Clear old values and switch column to the new enum
alter table public.landings
  alter column sector drop default;

alter table public.landings
  alter column sector type text using null;

alter table public.landings
  alter column sector type sector_kind_v2
  using null;

-- 3) Swap type names
drop type if exists sector_kind;
alter type sector_kind_v2 rename to sector_kind;

-- 4) Recreate the aggregate view used by GET /api/landings
create or replace view public.landings_with_like_count as
select
  l.*,
  coalesce((select count(*) from public.likes lk where lk.landing_id = l.id), 0) as likes_count
from public.landings l;
