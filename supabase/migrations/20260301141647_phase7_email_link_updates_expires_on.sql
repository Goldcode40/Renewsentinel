-- Phase 7: when an email_expiry_item_links row is created/updated,
-- update the linked compliance item's expires_on to the email's parsed_expiry_date (if present)
-- Optional: only do it for confidence >= 70 (prevents weak matches from overwriting dates)

drop trigger if exists update_compliance_item_expires_on_trigger on public.email_expiry_item_links;
drop function if exists public.auto_update_compliance_item_expires_on();

create or replace function public.auto_update_compliance_item_expires_on()
returns trigger
language plpgsql
as $fn$
declare
  v_email_date date;
begin
  -- Pull the email's parsed expiry date
  select ee.parsed_expiry_date
    into v_email_date
  from public.email_expiries ee
  where ee.id = new.email_expiry_id;

  -- If we don't have a parsed date, do nothing
  if v_email_date is null then
    return new;
  end if;

  -- Optional guard: only apply if confidence is decent
  if new.confidence is not null and new.confidence < 70 then
    return new;
  end if;

  -- Update the compliance item date (always trust the email date)
  update public.compliance_items ci
     set expires_on = v_email_date,
         updated_at = now()
   where ci.id = new.compliance_item_id
     and ci.expires_on is distinct from v_email_date;

  return new;
end;
$fn$;

create trigger update_compliance_item_expires_on_trigger
after insert or update on public.email_expiry_item_links
for each row execute function public.auto_update_compliance_item_expires_on();