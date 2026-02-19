-- RenewSentinel: initial core org model (Phase 2.1)
-- Tables: organizations, org_members
-- Note: RLS policies will be added in the next step (separate commit).

create extension if not exists "pgcrypto";

-- Organizations (workspaces)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Org members (roles)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('owner', 'manager', 'viewer');
  end if;
end $$;

create table if not exists public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null, -- will map to auth.users.id once Supabase Auth is wired
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_id_idx on public.org_members(user_id);
