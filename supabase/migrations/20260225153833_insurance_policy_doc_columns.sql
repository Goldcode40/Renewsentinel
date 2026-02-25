-- Add document metadata fields to insurance_policies
alter table if exists public.insurance_policies
  add column if not exists document_bucket text null,
  add column if not exists document_filename text null,
  add column if not exists document_content_type text null,
  add column if not exists document_size_bytes bigint null;

-- Ensure document_path exists (in case older migration differs)
alter table if exists public.insurance_policies
  add column if not exists document_path text null;