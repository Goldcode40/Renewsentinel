-- Allow non-compliance reminders by permitting NULL item_id
alter table if exists public.reminder_events
  alter column item_id drop not null;

-- Recreate FK to compliance_items (NULLs are allowed)
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'reminder_events'
      and constraint_name = 'reminder_events_item_id_fkey'
  ) then
    alter table public.reminder_events drop constraint reminder_events_item_id_fkey;
  end if;

  alter table public.reminder_events
    add constraint reminder_events_item_id_fkey
    foreign key (item_id) references public.compliance_items(id)
    on delete cascade;
end $$;