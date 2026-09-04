-- Dashboard Marketing PertaLife
-- Tanda Terima V29 — align evidence-file visibility with the registry
-- 2026-09-04
--
-- Registry rows for pertalife_document_handovers are intentionally visible to
-- every active authenticated non-SYSTEM_ADMIN profile. Evidence metadata and
-- Storage SELECT policies previously remained narrower (sender/receiver only),
-- which caused visible registry rows to fail Download Foto with a misleading
-- "File tidak ditemukan di penyimpanan pusat" message.
--
-- Keep this fix narrow to registered TANDA_TERIMA evidence only.

drop policy if exists "central_business_files_tanda_terima_select_v29"
on public.central_business_files;

create policy "central_business_files_tanda_terima_select_v29"
on public.central_business_files
for select
to authenticated
using (
  module = 'TANDA_TERIMA'
  and storage_key = 'pertalife_document_handovers'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.active = true
      and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
  )
);

drop policy if exists "business_files_tanda_terima_select_v29"
on storage.objects;

create policy "business_files_tanda_terima_select_v29"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-files'
  and split_part(name, '/', 1) = 'TANDA_TERIMA'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.active = true
      and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
  )
  and exists (
    select 1
    from public.central_business_files f
    where f.storage_path = objects.name
      and f.module = 'TANDA_TERIMA'
      and f.storage_key = 'pertalife_document_handovers'
  )
);
