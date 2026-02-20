-- RenewSentinel: item documents (Phase 2.4)
-- Links uploaded proof files to compliance items.

create table if not exists public.item_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.compliance_items(id) on delete cascade,

  storage_bucket text not null default 'item-docs',
  storage_path text not null, -- e.g. org/<org_id>/item/<item_id>/<uuid>-filename.pdf

  filename text not null,
  content_type text null,
  size_bytes bigint null,

  created_at timestamptz not null default now()
);

create index if not exists item_documents_org_id_idx on public.item_documents(org_id);
create index if not exists item_documents_item_id_idx on public.item_documents(item_id);
create index if not exists item_documents_created_at_idx on public.item_documents(created_at);
