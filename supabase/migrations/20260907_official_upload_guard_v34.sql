-- Narrow write guard for the three Arianie upload operations.
-- Existing target publisher RPC, ordinary pipeline updates, invoice maker/checker,
-- document workflows, and all unrelated business collections remain unchanged.
create or replace function public.guard_official_performance_upload_v34()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_protected boolean := false;
  v_old_source text;
  v_new_source text;
begin
  -- Trusted service-role maintenance remains available.
  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_protected := new.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches'
    );
    v_new_source := upper(trim(coalesce(new.payload ->> 'source', '')));
    if new.storage_key = 'pertalife_pipelines' and v_new_source = 'RKAP_BULK' then
      v_protected := true;
    end if;
  elsif tg_op = 'UPDATE' then
    v_protected := old.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches'
    ) or new.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches'
    );
    v_old_source := upper(trim(coalesce(old.payload ->> 'source', '')));
    v_new_source := upper(trim(coalesce(new.payload ->> 'source', '')));
    -- An existing RKAP pipeline may continue through the normal workflow.
    -- Only creation or conversion into a new RKAP_BULK record is restricted.
    if new.storage_key = 'pertalife_pipelines'
       and v_new_source = 'RKAP_BULK'
       and v_old_source <> 'RKAP_BULK' then
      v_protected := true;
    end if;
  else
    v_protected := old.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches'
    );
  end if;

  if v_protected and not public.can_publish_marketing_targets() then
    raise exception 'Hanya publisher Target dan Realisasi yang berwenang melakukan upload Official atau Bulk Pipeline.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function public.guard_official_performance_upload_v34() from public, anon, authenticated;

drop trigger if exists central_official_performance_upload_guard_v34 on public.central_business_entities;
create trigger central_official_performance_upload_guard_v34
before insert or update or delete on public.central_business_entities
for each row execute function public.guard_official_performance_upload_v34();
