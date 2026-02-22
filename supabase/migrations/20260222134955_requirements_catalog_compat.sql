-- Phase 3.1 Compatibility: requirements_catalog -> requirement_templates
-- The app currently queries a table named requirements_catalog with fields:
-- country,state,trade,requirement_type,title,issuer,source_url,description,
-- default_renewal_window_days,default_reminder_offsets_days,required_docs,is_active,created_at,updated_at
--
-- We implement this by:
-- 1) Adding the needed "catalog" columns to requirement_templates
-- 2) Creating a view named requirements_catalog that maps to requirement_templates

alter table public.requirement_templates
  add column if not exists country text not null default 'US',
  add column if not exists state text null,
  add column if not exists trade text null,
  add column if not exists requirement_type text not null default 'license',
  add column if not exists title text null,
  add column if not exists issuer text null,
  add column if not exists source_url text null,
  add column if not exists default_reminder_offsets_days int[] null,
  add column if not exists required_docs jsonb null;

-- Backfill title from name if missing
update public.requirement_templates
set title = coalesce(title, name)
where title is null;

-- Compatibility view moved to next migration (fix_requirements_catalog_view)\r\n-- Helpful indexes for the API query pattern
create index if not exists idx_req_templates_state_trade_active
  on public.requirement_templates (state, trade, is_active);

create index if not exists idx_req_templates_type
  on public.requirement_templates (requirement_type);


