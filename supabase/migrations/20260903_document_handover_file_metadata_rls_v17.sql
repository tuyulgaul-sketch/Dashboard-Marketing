-- Dashboard Marketing PertaLife
-- Tanda Terima V17 — profile-native file metadata RLS
-- 2026-09-03
--
-- V15 fixed TRM numbering for active profiles without legacy_user_id.
-- V16 fixed INSERT into storage.objects for TANDA_TERIMA evidence.
-- This migration covers the next layer: metadata rows in
-- public.central_business_files.
--
-- The policies remain narrow: TANDA_TERIMA only, authenticated active profile,
-- and access is scoped to sender / receiver / uploader runtime identity.

begin;

create or replace function public.current_business_runtime_user_id_v17()
returns text
language sql
security definer
stable
set search_path = public
as $function$
  select coalesce(
    nullif(trim(p.legacy_user_id), ''),
    'PRF-' || p.id::text
  )
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.active = true
  limit 1;
$function$;

revoke all
on function public.current_business_runtime_user_id_v17()
from public, anon;

grant execute
on function public.current_business_runtime_user_id_v17()
to authenticated;

comment on function public.current_business_runtime_user_id_v17()
is 'Returns the Dashboard Marketing runtime user ID for the authenticated active profile: legacy_user_id when present, otherwise PRF-<profile_uuid>.';

alter table public.central_business_files enable row level security;

drop policy if exists
  "central_business_files_tanda_terima_insert_v17"
on public.central_business_files;

create policy
  "central_business_files_tanda_terima_insert_v17"
on public.central_business_files
for insert
to authenticated
with check (
  module = 'TANDA_TERIMA'
  and storage_key = 'pertalife_document_handovers'
  and public.current_business_runtime_user_id_v17() is not null
  and visibility_payload ->> 'uploadedByUserId'
      = public.current_business_runtime_user_id_v17()
);

drop policy if exists
  "central_business_files_tanda_terima_select_v17"
on public.central_business_files;

create policy
  "central_business_files_tanda_terima_select_v17"
on public.central_business_files
for select
to authenticated
using (
  module = 'TANDA_TERIMA'
  and storage_key = 'pertalife_document_handovers'
  and public.current_business_runtime_user_id_v17() is not null
  and public.current_business_runtime_user_id_v17() in (
    visibility_payload ->> 'senderUserId',
    visibility_payload ->> 'receiverUserId',
    visibility_payload ->> 'uploadedByUserId'
  )
);

commit;
