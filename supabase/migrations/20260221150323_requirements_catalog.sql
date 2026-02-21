-- Phase 3.1: Requirements Catalog (starting narrow: HVAC)
-- Notes:
-- - Read-only for now (no RLS needed yet because no org/user ownership)
-- - We'll add authoring / admin controls later if needed

create table if not exists public.requirements_catalog (
  id uuid primary key default gen_random_uuid(),

  -- scope
  country text not null default 'US',
  state text not null, -- e.g. 'NH'
  trade text not null, -- 'hvac' | 'plumbing' | 'electrical'
  requirement_type text not null, -- 'license' | 'insurance' | 'permit' | 'cert'

  -- label + source
  title text not null,                -- e.g. 'HVAC Contractor License'
  issuer text,                        -- e.g. 'State Board'
  source_url text,                    -- where user can verify
  description text,                   -- plain language summary

  -- default behavior for items created from this requirement
  default_renewal_window_days int not null default 30,
  default_reminder_offsets_days int[] not null default '{30,14,7,1}',

  -- what proofs/docs are typically required
  required_docs jsonb not null default '[]'::jsonb,

  -- lifecycle
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful index for querying by wedge filters
create index if not exists requirements_catalog_lookup_idx
  on public.requirements_catalog (state, trade, requirement_type);

-- Minimal seed data (HVAC wedge, New Hampshire example)
insert into public.requirements_catalog
  (country, state, trade, requirement_type, title, issuer, source_url, description, default_renewal_window_days, default_reminder_offsets_days, required_docs)
values
  (
    'US', 'NH', 'hvac', 'license',
    'HVAC Contractor License',
    'State Licensing Board',
    null,
    'State-level contractor license requirement for HVAC work (example seed).',
    30,
    '{30,14,7,1}',
    '[
      {"key":"license_certificate","label":"License Certificate","required":true},
      {"key":"renewal_receipt","label":"Renewal Receipt","required":false}
    ]'::jsonb
  )
on conflict do nothing;

-- updated_at trigger (standard pattern)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_requirements_catalog_updated_at on public.requirements_catalog;

create trigger set_requirements_catalog_updated_at
before update on public.requirements_catalog
for each row execute function public.set_updated_at();
