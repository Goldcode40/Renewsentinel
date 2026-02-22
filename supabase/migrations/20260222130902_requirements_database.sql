-- Phase 3.1 Requirements Database
-- Adds a "requirements library" so orgs can quickly add common compliance requirements
-- and tie them to compliance items.

-- Ensure extension for UUIDs (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- 1) Requirement templates (the library)
create table if not exists public.requirement_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'license', -- license | insurance | training | registration | other
  description text null,

  -- Optional default guidance values
  default_renewal_window_days int null,
  default_grace_period_days int null,

  -- Metadata
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requirement_templates_active on public.requirement_templates (is_active);
create index if not exists idx_requirement_templates_category on public.requirement_templates (category);

-- 2) Organization-specific requirements (customized copies of templates)
create table if not exists public.org_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  template_id uuid null references public.requirement_templates(id) on delete set null,

  name text not null,
  category text not null default 'license',
  description text null,

  renewal_window_days int null,
  grace_period_days int null,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_requirements_org on public.org_requirements (org_id);
create index if not exists idx_org_requirements_template on public.org_requirements (template_id);
create index if not exists idx_org_requirements_active on public.org_requirements (is_active);

-- 3) Link table: which org requirement applies to which compliance item
create table if not exists public.compliance_item_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,

  compliance_item_id uuid not null,
  org_requirement_id uuid not null,

  created_at timestamptz not null default now(),

  unique (compliance_item_id, org_requirement_id)
);

create index if not exists idx_cir_org on public.compliance_item_requirements (org_id);
create index if not exists idx_cir_item on public.compliance_item_requirements (compliance_item_id);
create index if not exists idx_cir_req on public.compliance_item_requirements (org_requirement_id);

-- NOTE:
-- We are intentionally not adding foreign keys to org_id/compliance_item_id yet,
-- because projects vary in table names/constraints. We'll add FKs safely after we confirm
-- the exact compliance items table name in your schema.

