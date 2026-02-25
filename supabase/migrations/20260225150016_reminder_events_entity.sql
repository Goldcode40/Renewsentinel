-- Allow reminder_events to target non-compliance entities (insurance, subcontractor docs, etc.)
alter table if exists public.reminder_events
  add column if not exists entity_type text null,
  add column if not exists entity_id uuid null;

-- Backfill existing rows (compliance items) for consistency
update public.reminder_events
set entity_type = coalesce(entity_type, 'compliance_item'),
    entity_id   = coalesce(entity_id, item_id)
where entity_type is null or entity_id is null;

-- Helpful indexes for dedupe/query
create index if not exists reminder_events_entity_idx
  on public.reminder_events (org_id, entity_type, entity_id, scheduled_for);

create index if not exists reminder_events_org_sched_idx
  on public.reminder_events (org_id, scheduled_for);