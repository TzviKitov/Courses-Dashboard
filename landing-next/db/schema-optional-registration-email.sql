-- Allow registrations without email (optional field on public form).
alter table public.registrations
  alter column email drop not null;
