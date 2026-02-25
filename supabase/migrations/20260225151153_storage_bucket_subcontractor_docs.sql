-- Create Storage bucket for subcontractor documents (COI/W9/etc)
-- Safe to run multiple times.

insert into storage.buckets (id, name, public)
values ('subcontractor-docs', 'subcontractor-docs', false)
on conflict (id) do nothing;