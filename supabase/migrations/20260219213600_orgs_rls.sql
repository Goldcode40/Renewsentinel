-- RenewSentinel: RLS + policies for organizations and org_members
-- Assumes Supabase Auth: auth.uid() returns the current user id (uuid)

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;

-- Helper: is a member of org
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;

-- Helper: is an owner of org
create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- organizations: members can read org
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member"
on public.organizations
for select
using (public.is_org_member(id));

-- organizations: owners can update org (name)
drop policy if exists "org_update_owner" on public.organizations;
create policy "org_update_owner"
on public.organizations
for update
using (public.is_org_owner(id))
with check (public.is_org_owner(id));

-- org_members: members can read members of their org
drop policy if exists "org_members_select_member" on public.org_members;
create policy "org_members_select_member"
on public.org_members
for select
using (public.is_org_member(org_id));

-- org_members: owners can insert members
drop policy if exists "org_members_insert_owner" on public.org_members;
create policy "org_members_insert_owner"
on public.org_members
for insert
with check (public.is_org_owner(org_id));

-- org_members: owners can update roles
drop policy if exists "org_members_update_owner" on public.org_members;
create policy "org_members_update_owner"
on public.org_members
for update
using (public.is_org_owner(org_id))
with check (public.is_org_owner(org_id));

-- org_members: owners can delete members (including themselves; later we can prevent last-owner removal)
drop policy if exists "org_members_delete_owner" on public.org_members;
create policy "org_members_delete_owner"
on public.org_members
for delete
using (public.is_org_owner(org_id));
