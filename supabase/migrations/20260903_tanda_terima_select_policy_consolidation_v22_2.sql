-- Dashboard Marketing PertaLife
-- V22.2 — consolidate Tanda Terima global read into the existing entity policy
-- 2026-09-03
--
-- Avoids parallel permissive SELECT policies while preserving the exact V22
-- visibility rule: every active non-SYSTEM_ADMIN business account can read the
-- complete Tanda Terima registry; unrelated collections retain existing scope.

begin;

drop policy if exists
  "central_business_entities_tanda_terima_global_select_v22"
on public.central_business_entities;

drop policy if exists
  "central_business_entities_select_policy"
on public.central_business_entities;

create policy
  "central_business_entities_select_policy"
on public.central_business_entities
for select
to authenticated
using (
  public.central_can_view_business_entity(storage_key, payload)
  or public.central_can_view_published_admin_catalog_entity(storage_key, payload)
  or (
    storage_key = 'pertalife_document_handovers'
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and p.active = true
        and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
    )
  )
);

commit;
