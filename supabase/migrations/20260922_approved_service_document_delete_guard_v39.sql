-- Approved/published service documents may be permanently deleted only by:
-- 1) Karina Nur Malika (USR-000031) for Marketing Communication documents.
-- 2) Marketing Administration upload operators for Marketing Administration documents.
-- Service-role maintenance remains allowed.

create or replace function public.guard_published_service_document_delete_v39()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor public.profiles%rowtype;
  v_owner_area text;
  v_status text;
  v_actor_legacy_id text;
begin
  if old.storage_key <> 'pertalife_service_documents' then
    return old;
  end if;

  if (select auth.role()) = 'service_role' then
    return old;
  end if;

  v_owner_area :=
    upper(
      trim(
        coalesce(
          old.payload ->> 'ownerArea',
          ''
        )
      )
    );

  v_status :=
    upper(
      trim(
        coalesce(
          old.payload ->> 'status',
          ''
        )
      )
    );

  if v_status <> 'PUBLISHED' then
    raise exception
      'Hanya dokumen approved / published yang dapat dihapus.';
  end if;

  select p.*
  into v_actor
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.active = true
  limit 1;

  if v_actor.id is null then
    raise exception 'Profil aktif tidak ditemukan.';
  end if;

  v_actor_legacy_id :=
    upper(
      trim(
        coalesce(
          v_actor.legacy_user_id,
          ''
        )
      )
    );

  if v_owner_area = 'MARKETING_COMMUNICATION' then
    if v_actor_legacy_id <> 'USR-000031' then
      raise exception
        'Hanya Karina yang dapat menghapus Marketing Tool approved.';
    end if;

    return old;
  end if;

  if v_owner_area = 'MARKETING_ADMINISTRATION' then
    if v_actor_legacy_id not in (
      'USR-000025',
      'USR-000026',
      'USR-000027',
      'USR-000029'
    ) then
      raise exception
        'Hanya operator Marketing Administration yang dapat menghapus dokumen approved pada area ini.';
    end if;

    return old;
  end if;

  raise exception
    'Service owner dokumen tidak valid untuk penghapusan.';
end;
$function$;

drop trigger if exists service_document_delete_guard_v39
on public.central_business_entities;

create trigger service_document_delete_guard_v39
before delete on public.central_business_entities
for each row
when (old.storage_key = 'pertalife_service_documents')
execute function public.guard_published_service_document_delete_v39();

revoke execute on function public.guard_published_service_document_delete_v39()
from public, anon, authenticated;
