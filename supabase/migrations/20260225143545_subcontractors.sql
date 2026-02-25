-- Subcontractors (org-scoped)
create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  contact_name text null,
  email text null,
  phone text null,
  trade text null, -- e.g. electrical, plumbing, hvac
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractors_org_id_idx on public.subcontractors (org_id);
create index if not exists subcontractors_org_active_idx on public.subcontractors (org_id, is_active);

-- Subcontractor docs (COI, W-9, licenses, etc.)
create table if not exists public.subcontractor_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  doc_type text not null, -- coi, w9, license, cert, other
  title text null,
  expires_on date null,
  storage_bucket text null,
  storage_path text null,
  filename text null,
  content_type text null,
  size_bytes bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractor_docs_org_id_idx on public.subcontractor_documents (org_id);
create index if not exists subcontractor_docs_sub_id_idx on public.subcontractor_documents (subcontractor_id);
create index if not exists subcontractor_docs_org_exp_idx on public.subcontractor_documents (org_id, expires_on);

-- updated_at triggers
drop trigger if exists set_updated_at_subcontractors on public.subcontractors;
create trigger set_updated_at_subcontractors
before update on public.subcontractors
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_subcontractor_documents on public.subcontractor_documents;
create trigger set_updated_at_subcontractor_documents
before update on public.subcontractor_documents
for each row execute function public.set_updated_at();