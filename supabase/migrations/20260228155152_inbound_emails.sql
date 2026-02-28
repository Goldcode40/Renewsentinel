-- Inbound emails (raw storage + parsing status)
create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  provider text not null default 'mailhook',
  message_id text,
  from_email text,
  subject text,
  received_at timestamptz not null default now(),
  raw_text text,
  raw_html text,
  raw_headers jsonb,
  parse_status text not null default 'pending', -- pending|parsed|failed|ignored
  parsed jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inbound_emails_org_idx on public.inbound_emails(org_id);
create index if not exists inbound_emails_status_idx on public.inbound_emails(parse_status);

alter table public.inbound_emails enable row level security;

drop policy if exists "inbound_emails_read_member" on public.inbound_emails;
create policy "inbound_emails_read_member"
on public.inbound_emails
for select
to authenticated
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = inbound_emails.org_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "inbound_emails_write_owner" on public.inbound_emails;
create policy "inbound_emails_write_owner"
on public.inbound_emails
for all
to authenticated
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = inbound_emails.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.org_members m
    where m.org_id = inbound_emails.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);