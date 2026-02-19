-- RenewSentinel: compliance items (Phase 2.2)
-- Table: compliance_items (licenses, certs, insurance, permits)

do $$ begin
  if not exists (select 1 from pg_type where typname = 'compliance_item_type') then
    create type public.compliance_item_type as enum ('license','cert','insurance','permit');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'compliance_status') then
    create type public.compliance_status as enum ('green','yellow','red');
  end if;
end $$;

create table if not exists public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  type public.compliance_item_type not null,
  title text not null,              -- e.g., "HVAC Contractor License"
  issuer text null,                 -- issuing authority
  identifier text null,             -- license/cert/policy #
  expires_on date not null,
  renewal_window_days int not null default 30,

  status public.compliance_status not null default 'green',

  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_items_org_id_idx on public.compliance_items(org_id);
create index if not exists compliance_items_expires_on_idx on public.compliance_items(expires_on);
create index if not exists compliance_items_status_idx on public.compliance_items(status);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_compliance_items_updated_at on public.compliance_items;
create trigger set_compliance_items_updated_at
before update on public.compliance_items
for each row execute function public.set_updated_at();
