-- OAuth tokens for integrations (Google Calendar first)
create table if not exists public.oauth_tokens (
  org_id uuid not null,
  provider text not null,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expiry_date timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (org_id, provider)
);

create index if not exists oauth_tokens_provider_idx on public.oauth_tokens(provider);

-- RLS
alter table public.oauth_tokens enable row level security;

-- Org members can read tokens for their org (used by backend routes)
drop policy if exists "oauth_tokens_read_member" on public.oauth_tokens;
create policy "oauth_tokens_read_member"
on public.oauth_tokens
for select
to authenticated
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = oauth_tokens.org_id
      and m.user_id = auth.uid()
  )
);

-- Only org owners/admins can write tokens (connect/disconnect)
drop policy if exists "oauth_tokens_write_admin" on public.oauth_tokens;
create policy "oauth_tokens_write_admin"
on public.oauth_tokens
for all
to authenticated
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = oauth_tokens.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = oauth_tokens.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

