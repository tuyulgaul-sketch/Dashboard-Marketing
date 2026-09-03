-- Dashboard Marketing PertaLife
-- Tanda Terima V16 — profile-native Storage RLS
-- 2026-09-03
--
-- V15 removed the obsolete legacy_user_id requirement from TRM number
-- reservation. The next submit step uploads evidence to the private
-- `business-files` bucket before the Tanda Terima registry is persisted.
--
-- Existing Storage RLS was created for the older legacy-user runtime and can
-- reject an authenticated active profile that has no legacy_user_id with:
--   new row violates row-level security policy
--
-- This migration adds a deliberately narrow INSERT policy only for
-- TANDA_TERIMA objects. It does NOT open the whole bucket or other modules.

begin;

create or replace function public.is_active_authenticated_profile_v16()
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.active = true
  );
$function$;

revoke all
on function public.is_active_authenticated_profile_v16()
from public, anon;

grant execute
on function public.is_active_authenticated_profile_v16()
to authenticated;

comment on function public.is_active_authenticated_profile_v16()
is 'Returns true when auth.uid() belongs to an active Dashboard Marketing profile. V16 helper for profile-native Tanda Terima Storage RLS.';

-- Policies are OR-combined. Keep any existing legacy policies untouched and
-- add only the missing profile-native path for Tanda Terima evidence uploads.
drop policy if exists
  "business_files_tanda_terima_insert_v16"
on storage.objects;

create policy
  "business_files_tanda_terima_insert_v16"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-files'
  and split_part(name, '/', 1) = 'TANDA_TERIMA'
  and public.is_active_authenticated_profile_v16()
);

commit;
