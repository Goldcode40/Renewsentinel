-- Phase 7.3: Link email expiry signals to compliance items
-- This table maps a parsed email expiry (email_expiries) to a compliance item (compliance_items)

create table if not exists public.email_expiry_item_links (
  id uuid primary key default gen_random_uuid(),

  org_id uuid not null references public.organizations(id) on delete cascade,
  email_expiry_id uuid not null references public.email_expiries(id) on delete cascade,
  compliance_item_id uuid not null references public.compliance_items(id) on delete cascade,

  confidence integer not null default 0,
  created_at timestamptz not null default now()
);

-- Prevent duplicate links
create unique index if not exists email_expiry_item_links_unique
on public.email_expiry_item_links (org_id, email_expiry_id, compliance_item_id);

-- Basic guardrails
alter table public.email_expiry_item_links
  drop constraint if exists email_expiry_item_links_confidence_check;

alter table public.email_expiry_item_links
  add constraint email_expiry_item_links_confidence_check
  check (confidence >= 0 and confidence <= 100);