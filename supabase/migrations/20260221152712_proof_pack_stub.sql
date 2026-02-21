-- Phase 4.1: Proof Pack Export (stub)
-- Goal: create a lightweight table to track proof pack exports.
-- NOTE: We are intentionally NOT enabling RLS here yet to avoid policy mismatches.
-- We will enforce access in the API first, then add RLS safely once we confirm org membership helpers.

create table if not exists public.proof_pack_exports (
  id uuid primary key default gen_random_uuid(),

  org_id uuid not null references public.organizations(id) on delete cascade,

  -- optional labels / filters
  case_name text,
  filters jsonb not null default '{}'::jsonb,

  -- export metadata
  format text not null default 'json', -- future: 'pdf'
  status text not null default 'generated', -- future: 'queued' | 'generated' | 'failed'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proof_pack_exports_org_id_idx
  on public.proof_pack_exports (org_id, created_at desc);

-- updated_at trigger (re-uses public.set_updated_at() created earlier)
drop trigger if exists set_proof_pack_exports_updated_at on public.proof_pack_exports;

create trigger set_proof_pack_exports_updated_at
before update on public.proof_pack_exports
for each row execute function public.set_updated_at();

