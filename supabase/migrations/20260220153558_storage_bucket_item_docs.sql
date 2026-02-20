-- RenewSentinel: storage bucket for item documents (Phase 2.4)
-- Creates the 'item-docs' bucket (private) idempotently.

insert into storage.buckets (id, name, public)
values ('item-docs', 'item-docs', false)
on conflict (id) do nothing;
