-- PR #23, approved hardening: only Marketing Administration may mutate its
-- SPAJ/SPAK. Preserve every existing business workflow and publisher policy.
-- The v31 reader remains unchanged. No business rows or profiles are migrated.
begin;

create or replace function public.is_protected_admin_document_v32(
  p_storage_key text, p_payload jsonb
)
returns boolean language sql immutable
set search_path = ''
as $function$
  select p_storage_key = 'pertalife_service_documents'
    and upper(trim(coalesce(p_payload ->> 'ownerArea', ''))) = 'MARKETING_ADMINISTRATION'
    and upper(trim(coalesce(p_payload ->> 'category', ''))) in ('SPAJ', 'SPAK');
$function$;
revoke all on function public.is_protected_admin_document_v32(text,jsonb)
from public, anon, authenticated;

create or replace function public.is_admin_document_mutator_v32()
returns boolean language sql stable security definer
set search_path = ''
as $function$
  select (select auth.role()) = 'service_role'
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and p.active = true
        and lower(trim(coalesce(p.unit, ''))) = 'marketing support'
        and lower(trim(coalesce(p.department, ''))) = 'marketing administration'
        and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
    );
$function$;
revoke all on function public.is_admin_document_mutator_v32()
from public, anon, authenticated;

-- Check both the old and new record, so changing owner/category cannot
-- disguise an update or deletion of a protected document.
create or replace function public.guard_admin_document_entity_v32()
returns trigger language plpgsql security definer
set search_path = ''
as $function$
declare
  v_protected boolean := false;
begin
  if tg_op = 'INSERT' then
    v_protected := public.is_protected_admin_document_v32(new.storage_key, new.payload);
  elsif tg_op = 'DELETE' then
    v_protected := public.is_protected_admin_document_v32(old.storage_key, old.payload);
  else
    v_protected := public.is_protected_admin_document_v32(old.storage_key, old.payload)
      or public.is_protected_admin_document_v32(new.storage_key, new.payload);
  end if;
  if v_protected and not public.is_admin_document_mutator_v32() then
    raise exception 'Only Marketing Administration may mutate its SPAJ/SPAK.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.guard_admin_document_entity_v32()
from public, anon, authenticated;
drop trigger if exists guard_admin_document_entity_v32 on public.central_business_entities;
create trigger guard_admin_document_entity_v32
before insert or update or delete on public.central_business_entities
for each row execute function public.guard_admin_document_entity_v32();

-- Resolve file ownership from authoritative entity metadata, not from a
-- caller-supplied visibility payload or a user-editable JWT field.
create or replace function public.is_protected_admin_file_v32(
  p_file_id text, p_entity_id text
)
returns boolean language sql stable security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.central_business_entities e
    where e.storage_key = 'pertalife_service_documents'
      and e.entity_id in (p_file_id, p_entity_id)
      and public.is_protected_admin_document_v32(e.storage_key, e.payload)
  );
$function$;
revoke all on function public.is_protected_admin_file_v32(text,text)
from public, anon, authenticated;

-- Covers register/delete metadata RPCs, direct DML and reassignment of an
-- existing file to a different entity. Other file modules are unchanged.
create or replace function public.guard_admin_document_file_v32()
returns trigger language plpgsql security definer
set search_path = ''
as $function$
declare
  v_protected boolean := false;
begin
  if tg_op = 'INSERT' then
    v_protected := public.is_protected_admin_file_v32(new.file_id, new.entity_id);
  elsif tg_op = 'DELETE' then
    v_protected := public.is_protected_admin_file_v32(old.file_id, old.entity_id);
  else
    v_protected := public.is_protected_admin_file_v32(old.file_id, old.entity_id)
      or public.is_protected_admin_file_v32(new.file_id, new.entity_id);
  end if;
  if v_protected and not public.is_admin_document_mutator_v32() then
    raise exception 'Only Marketing Administration may mutate its SPAJ/SPAK files.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.guard_admin_document_file_v32()
from public, anon, authenticated;
drop trigger if exists guard_admin_document_file_v32 on public.central_business_files;
create trigger guard_admin_document_file_v32
before insert or update or delete on public.central_business_files
for each row execute function public.guard_admin_document_file_v32();

-- Add a restrictive AND condition to existing Storage write policies.
-- An unregistered file in a protected document folder is protected too.
-- All other buckets and files keep their existing permissions.
create or replace function public.can_mutate_admin_document_object_v32(
  p_bucket_id text, p_path text
)
returns boolean language sql stable security definer
set search_path = ''
as $function$
  select p_bucket_id is distinct from 'business-files'
    or not (
      exists (
        select 1 from public.central_business_files f
        where f.storage_path = p_path
          and public.is_protected_admin_file_v32(f.file_id, f.entity_id)
      )
      or (
        split_part(p_path, '/', 1) = 'MARKETING_SUPPORT'
        and exists (
          select 1 from public.central_business_entities e
          where e.storage_key = 'pertalife_service_documents'
            and e.entity_id = split_part(p_path, '/', 2)
            and public.is_protected_admin_document_v32(e.storage_key, e.payload)
        )
      )
    )
    or public.is_admin_document_mutator_v32();
$function$;
revoke all on function public.can_mutate_admin_document_object_v32(text,text)
from public, anon, authenticated;
grant execute on function public.can_mutate_admin_document_object_v32(text,text)
to authenticated;

drop policy if exists business_files_admin_guard_insert_v32 on storage.objects;
create policy business_files_admin_guard_insert_v32 on storage.objects
as restrictive for insert to authenticated
with check (public.can_mutate_admin_document_object_v32(bucket_id, name));

drop policy if exists business_files_admin_guard_update_v32 on storage.objects;
create policy business_files_admin_guard_update_v32 on storage.objects
as restrictive for update to authenticated
using (public.can_mutate_admin_document_object_v32(bucket_id, name))
with check (public.can_mutate_admin_document_object_v32(bucket_id, name));

drop policy if exists business_files_admin_guard_delete_v32 on storage.objects;
create policy business_files_admin_guard_delete_v32 on storage.objects
as restrictive for delete to authenticated
using (public.can_mutate_admin_document_object_v32(bucket_id, name));

-- Fail the migration if the reader's pre-existing foundation is absent.
do $check$
begin
  if to_regprocedure('public.list_published_admin_documents_v31()') is null
     or to_regprocedure('public.can_read_published_admin_document_v31(text)') is null then
    raise exception 'v31 read-only migration must be applied before v32.';
  end if;
end;
$check$;
commit;
