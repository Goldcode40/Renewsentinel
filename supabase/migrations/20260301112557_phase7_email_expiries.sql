-- Phase 7.2: Email parsing / expiry detection storage
-- Stores parsed expiry signals from Gmail messages so we can map them to compliance items later.

create table if not exists public.email_expiries (
  id uuid primary key default gen_random_uuid(),

  -- multi-tenant (RenewSentinel org)
  org_id uuid not null,

  -- Gmail identifiers
  gmail_message_id text not null,
  gmail_thread_id text null,

  -- metadata we captured
  from_email text null,
  subject text null,
  gmail_date_header text null,
  snippet text null,

  -- parser output
  parsed_expiry_date date null,

  -- optional matching fields (filled later)
  matched_item_id uuid null,
  match_confidence int null, -- 0-100

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uniqueness: a Gmail message can only exist once per org
create unique index if not exists email_expiries_org_msg_uq
  on public.email_expiries (org_id, gmail_message_id);

-- Useful query indexes
create index if not exists email_expiries_org_expiry_idx
  on public.email_expiries (org_id, parsed_expiry_date);

create index if not exists email_expiries_org_item_idx
  on public.email_expiries (org_id, matched_item_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_email_expiries_updated_at on public.email_expiries;
create trigger trg_email_expiries_updated_at
before update on public.email_expiries
for each row execute function public.set_updated_at();

