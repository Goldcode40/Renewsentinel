-- RenewSentinel: reminder events (Phase 2.3)
-- Tracks reminder sends (and future channels) for compliance items.

create table if not exists public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.compliance_items(id) on delete cascade,

  channel text not null default 'email', -- email | sms | push
  kind text not null default 'pre_expiry', -- pre_expiry | expired | custom
  scheduled_for timestamptz not null,
  sent_at timestamptz null,

  to_email text null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists reminder_events_org_id_idx on public.reminder_events(org_id);
create index if not exists reminder_events_item_id_idx on public.reminder_events(item_id);
create index if not exists reminder_events_scheduled_for_idx on public.reminder_events(scheduled_for);
