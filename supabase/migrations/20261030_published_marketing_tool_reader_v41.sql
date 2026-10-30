-- Only active, authorized Dashboard Marketing catalogue readers may view published
-- Marketing Communication tools. This extends SELECT only; upload, approval,
-- mutation and unpublished records remain governed by their existing policies.
begin;

create or replace function public.can_read_marketing_tool_catalog_v41()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.active = true
      and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
      and upper(trim(coalesce(p.legacy_user_id, ''))) ~ '^USR-[0-9]{6}$'
      and (
        lower(trim(coalesce(p.unit, ''))) <> 'marketing support'
        or (
          lower(trim(coalesce(p.unit, ''))) = 'marketing support'
          and (
            lower(trim(coalesce(p.department, ''))) = 'marketing communication'
            or trim(coalesce(p.department, '')) = ''
          )
        )
      )
  );
$function$;

revoke all on function public.can_read_marketing_tool_catalog_v41()
from public, anon, authenticated;
grant execute on function public.can_read_marketing_tool_catalog_v41()
to authenticated;

create or replace function public.can_read_published_marketing_tool_entity_v41(
  p_storage_key text, p_payload jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select public.can_read_marketing_tool_catalog_v41())
    and p_storage_key = 'pertalife_service_documents'
    and upper(trim(coalesce(p_payload ->> 'ownerArea', ''))) = 'MARKETING_COMMUNICATION'
    and upper(trim(coalesce(p_payload ->> 'status', ''))) = 'PUBLISHED'
    and upper(trim(coalesce(p_payload ->> 'category', '')))
      in ('PROPOSAL_PENAWARAN_STANDAR', 'MATERI_PRESENTASI', 'BROSUR');
$function$;

revoke all on function public.can_read_published_marketing_tool_entity_v41(text, jsonb)
from public, anon, authenticated;
grant execute on function public.can_read_published_marketing_tool_entity_v41(text, jsonb)
to authenticated;

-- A document may be a single object or a manifest with 5 MB chunks.
-- Recheck publication status against the parent record on every file read.
create or replace function public.can_read_published_marketing_tool_file_v41(
  p_file_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select public.can_read_marketing_tool_catalog_v41())
    and exists (
      select 1
      from public.central_business_files f
      join public.central_business_entities e
        on e.storage_key = 'pertalife_service_documents'
       and e.entity_id = f.entity_id
      where f.file_id = p_file_id
        and f.module = 'MARKETING_SUPPORT'
        and f.storage_key = 'pertalife_service_documents'
        and (
          f.file_id = e.entity_id
          or f.metadata ->> 'parentFileId' = e.entity_id
        )
        and upper(trim(coalesce(e.payload ->> 'ownerArea', ''))) = 'MARKETING_COMMUNICATION'
        and upper(trim(coalesce(e.payload ->> 'status', ''))) = 'PUBLISHED'
        and upper(trim(coalesce(e.payload ->> 'category', '')))
          in ('PROPOSAL_PENAWARAN_STANDAR', 'MATERI_PRESENTASI', 'BROSUR')
    );
$function$;

revoke all on function public.can_read_published_marketing_tool_file_v41(text)
from public, anon, authenticated;
grant execute on function public.can_read_published_marketing_tool_file_v41(text)
to authenticated;

-- Additive reader grants. Existing RLS policies and approver permissions are intact.
create policy marketing_tool_published_entity_select_v41
on public.central_business_entities
for select to authenticated
using (public.can_read_published_marketing_tool_entity_v41(storage_key, payload));

create policy marketing_tool_published_file_select_v41
on public.central_business_files
for select to authenticated
using (public.can_read_published_marketing_tool_file_v41(file_id));

create policy marketing_tool_published_object_select_v41
on storage.objects
for select to authenticated
using (
  bucket_id = 'business-files'
  and split_part(name, '/', 1) = 'MARKETING_SUPPORT'
  and exists (
    select 1
    from public.central_business_files f
    where f.storage_path = objects.name
      and f.module = 'MARKETING_SUPPORT'
      and f.storage_key = 'pertalife_service_documents'
      and public.can_read_published_marketing_tool_file_v41(f.file_id)
  )
);
commit;
