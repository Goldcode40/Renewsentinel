-- Create Storage bucket for insurance policy documents
-- Safe to run multiple times.

insert into storage.buckets (id, name, public)
values ('insurance-docs', 'insurance-docs', false)
on conflict (id) do nothing;