-- Phase 4.2: Audit Log (trust + legal defense)
-- Minimal, append-only event log.
-- We can backfill richer actor info later (Supabase Auth / real users).

create table if not exists public.audit_log_events (
  id uuid primary key default gen_random_uuid(),

  org_id uuid not null references public.organizations(id) on delete cascade,

  -- actor info (v0: dev user / system)
  actor_user_id uuid null,
  actor_role text null, -- e.g. 'owner' | 'member' | 'system'

  -- what happened
  action text not null, -- e.g. 'item.created', 'item.updated', 'doc.uploaded', 'proofpack.exported'
  entity_type text null, -- e.g. 'compliance_item' | 'item_document' | 'proof_pack'
  entity_id uuid null,

  -- extra details (safe for audit trail, keep small)
  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists audit_log_events_org_created_idx
  on public.audit_log_events (org_id, created_at desc);

create index if not exists audit_log_events_action_idx
  on public.audit_log_events (action);

