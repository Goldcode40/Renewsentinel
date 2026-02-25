-- Insurance policies (org-scoped)
create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  provider text not null,
  policy_number text null,
  policy_type text not null, -- e.g. General Liability, Workers Comp, Auto
  effective_date date null,
  expiry_date date not null,
  coverage_amount numeric null,
  document_path text null, -- stored file path in Supabase Storage (if any)
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Basic index for org-scoped queries + upcoming expirations
create index if not exists insurance_policies_org_id_idx on public.insurance_policies (org_id);
create index if not exists insurance_policies_org_expiry_idx on public.insurance_policies (org_id, expiry_date);

-- updated_at trigger (re-uses the typical Postgres pattern)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_insurance_policies on public.insurance_policies;
create trigger set_updated_at_insurance_policies
before update on public.insurance_policies
for each row execute function public.set_updated_at();
