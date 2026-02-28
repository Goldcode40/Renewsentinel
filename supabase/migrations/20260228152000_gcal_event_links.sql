-- Map RenewSentinel entities to Google Calendar events (so we can update/delete later)
create table if not exists public.gcal_event_links (
  org_id uuid not null,
  entity_type text not null,          -- 'item' | 'insurance' | 'subcontractor' (future)
  entity_id uuid not null,
  calendar_id text not null default 'primary',
  event_id text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (org_id, entity_type, entity_id)
);

create index if not exists gcal_event_links_event_id_idx on public.gcal_event_links(event_id);

alter table public.gcal_event_links enable row level security;

-- Members can read mappings
drop policy if exists "gcal_links_read_member" on public.gcal_event_links;
create policy "gcal_links_read_member"
on public.gcal_event_links
for select
to authenticated
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = gcal_event_links.org_id
      and m.user_id = auth.uid()
  )
);

-- Owner can write mappings
drop policy if exists "gcal_links_write_owner" on public.gcal_event_links;
create policy "gcal_links_write_owner"
on public.gcal_event_links
for all
to authenticated
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = gcal_event_links.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.org_members m
    where m.org_id = gcal_event_links.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);