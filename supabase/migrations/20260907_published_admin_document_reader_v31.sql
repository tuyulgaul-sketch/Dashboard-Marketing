-- PR #23: read-only SPAJ/SPAK catalogue for Marketing Communication and
-- Digital & Affinity. Existing publisher rights and mutation RPCs are unchanged.
-- Review live schema/policies and test before applying this migration.
begin;

create or replace function public.is_cross_support_admin_document_reader_v31()
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.active = true
      and lower(trim(coalesce(p.unit, ''))) = 'marketing support'
      and lower(trim(coalesce(p.department, ''))) in
        ('marketing communication', 'digital & affinity')
      and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
  );
$function$;
revoke all on function public.is_cross_support_admin_document_reader_v31()
from public, anon, authenticated;
grant execute on function public.is_cross_support_admin_document_reader_v31()
to authenticated;

-- Return only catalogue fields, never arbitrary business payloads.
create or replace function public.list_published_admin_documents_v31()
returns setof jsonb
language sql stable security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', e.entity_id,
    'ownerArea', 'MARKETING_ADMINISTRATION',
    'status', 'PUBLISHED',
    'title', e.payload ->> 'title',
    'category', e.payload ->> 'category',
    'productName', e.payload ->> 'productName',
    'version', e.payload -> 'version',
    'versionLabel', e.payload ->> 'versionLabel',
    'fileName', e.payload ->> 'fileName',
    'uploadedAt', e.payload ->> 'uploadedAt',
    'approvedAt', e.payload ->> 'approvedAt'
  )
  from public.central_business_entities e
  where (select public.is_cross_support_admin_document_reader_v31())
    and e.storage_key = 'pertalife_service_documents'
    and e.payload ->> 'ownerArea' = 'MARKETING_ADMINISTRATION'
    and e.payload ->> 'status' = 'PUBLISHED'
    and e.payload ->> 'category' in ('SPAJ', 'SPAK')
  order by e.payload ->> 'approvedAt' desc nulls last, e.entity_id;
$function$;
revoke all on function public.list_published_admin_documents_v31()
from public, anon, authenticated;
grant execute on function public.list_published_admin_documents_v31()
to authenticated;

-- Definer lookup avoids RLS recursion. Publication is rechecked for every
-- file request, including after a document has been unpublished.
create or replace function public.can_read_published_admin_document_v31(
  p_file_id text
)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select (select public.is_cross_support_admin_document_reader_v31())
    and exists (
      select 1
      from public.central_business_files f
      join public.central_business_entities e
        on e.storage_key = 'pertalife_service_documents'
       and e.entity_id = f.entity_id
      where f.file_id = p_file_id
        and f.module = 'MARKETING_SUPPORT'
        and f.storage_key = 'pertalife_service_documents'
        and f.entity_id = f.file_id
        and e.payload ->> 'ownerArea' = 'MARKETING_ADMINISTRATION'
        and e.payload ->> 'status' = 'PUBLISHED'
        and e.payload ->> 'category' in ('SPAJ', 'SPAK')
    );
$function$;
revoke all on function public.can_read_published_admin_document_v31(text)
from public, anon, authenticated;
grant execute on function public.can_read_published_admin_document_v31(text)
to authenticated;

-- Additive SELECT only. No INSERT, UPDATE, DELETE, publisher, or approval grants.
alter table public.central_business_files enable row level security;
drop policy if exists central_business_files_admin_reader_select_v31
on public.central_business_files;
create policy central_business_files_admin_reader_select_v31
on public.central_business_files
for select to authenticated
using (public.can_read_published_admin_document_v31(file_id));

drop policy if exists business_files_admin_reader_select_v31
on storage.objects;
create policy business_files_admin_reader_select_v31
on storage.objects
for select to authenticated
using (
  bucket_id = 'business-files'
  and split_part(name, '/', 1) = 'MARKETING_SUPPORT'
  and exists (
    select 1 from public.central_business_files f
    where f.storage_path = objects.name
      and f.module = 'MARKETING_SUPPORT'
      and f.storage_key = 'pertalife_service_documents'
      and public.can_read_published_admin_document_v31(f.file_id)
  )
);
commit;
