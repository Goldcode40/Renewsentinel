-- Fix: requirements_catalog already exists but is not a view.
-- Rename legacy object (table/materialized view/other) out of the way, then create the view.

do $$
declare
  obj_kind text;
  legacy_name text;
begin
  select c.relkind
    into obj_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'requirements_catalog'
  limit 1;

  -- relkind:
  -- 'v' = view, 'r' = table, 'm' = materialized view, etc.
  if obj_kind is not null and obj_kind <> 'v' then
    legacy_name := 'requirements_catalog_legacy_' || to_char(now(), 'YYYYMMDDHH24MISS');
    execute format('alter table public.requirements_catalog rename to %I', legacy_name);
  end if;

  -- If it was a materialized view or other relkind, the above alter table might fail.
  -- Handle those cases by dropping with rename fallback.
exception
  when undefined_table then
    -- nothing to do
    null;
  when others then
    -- Try a safer path: if it's a materialized view, rename it
    begin
      legacy_name := 'requirements_catalog_legacy_' || to_char(now(), 'YYYYMMDDHH24MISS');
      execute format('alter materialized view public.requirements_catalog rename to %I', legacy_name);
    exception
      when others then
        -- last resort: drop it (we tried to preserve it)
        execute 'drop table if exists public.requirements_catalog cascade';
        execute 'drop materialized view if exists public.requirements_catalog cascade';
    end;
end $$;

create or replace view public.requirements_catalog as
select
  id,
  country,
  state,
  trade,
  requirement_type,
  coalesce(title, name) as title,
  issuer,
  source_url,
  description,
  default_renewal_window_days,
  default_reminder_offsets_days,
  required_docs,
  is_active,
  created_at,
  updated_at
from public.requirement_templates;

