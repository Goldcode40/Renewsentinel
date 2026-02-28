-- Phase 6: Async Concierge (no calls) tables

create table if not exists public.concierge_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,

  status text not null default 'not_started'
    check (status in ('not_started','submitted','in_review','completed','rejected')),

  -- Intake fields (keep it minimal to start)
  profile_state text null,
  profile_trade text null,
  notes text null,

  -- Ops fields
  assigned_to uuid null,
  completed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_concierge_requests_org_id on public.concierge_requests(org_id);
create index if not exists idx_concierge_requests_status on public.concierge_requests(status);
create index if not exists idx_concierge_requests_created_at on public.concierge_requests(created_at);

-- Basic updated_at trigger (idempotent)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_concierge_requests_updated_at on public.concierge_requests;

create trigger trg_concierge_requests_updated_at
before update on public.concierge_requests
for each row execute function public.set_updated_at();

-- Documents uploaded as part of concierge intake/review
create table if not exists public.concierge_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.concierge_requests(id) on delete cascade,

  doc_type text null, -- e.g. 'license', 'insurance', 'cert', 'other'
  bucket text null,
  path text null,

  original_filename text null,
  mime_type text null,
  size_bytes bigint null,

  uploaded_by uuid null,

  created_at timestamptz not null default now()
);

create index if not exists idx_concierge_documents_request_id on public.concierge_documents(request_id);
