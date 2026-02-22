-- Org profile fields for wizard defaults
alter table public.organizations
  add column if not exists profile_state text null,
  add column if not exists profile_trade text null;

-- Optional: basic index for filtering/reporting
create index if not exists idx_org_profile_state_trade
  on public.organizations (profile_state, profile_trade);
