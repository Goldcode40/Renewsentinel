-- Phase 8: Stripe billing fields + idempotent webhook event log

-- 1) Add billing columns to organizations
alter table if exists public.organizations
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists billing_status text;

-- Helpful index for lookups from Stripe webhooks
create index if not exists organizations_stripe_customer_id_idx
  on public.organizations (stripe_customer_id);

create index if not exists organizations_stripe_subscription_id_idx
  on public.organizations (stripe_subscription_id);

-- 2) Stripe webhook event log for idempotency + debugging
create table if not exists public.stripe_events (
  id text primary key, -- Stripe event id (evt_...)
  type text not null,
  created timestamptz not null default now(),
  payload jsonb not null
);

-- Optional: small helper view for quick debugging
create or replace view public.stripe_events_recent as
select id, type, created
from public.stripe_events
order by created desc
limit 100;
