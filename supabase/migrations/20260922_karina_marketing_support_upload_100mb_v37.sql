-- Karina Nur Malika (USR-000031) may upload Marketing Support files up to 100 MB.
-- Other central business uploads remain capped at 10 MB by register_central_business_file().
-- Bucket/table limits are infrastructure ceilings; authorization remains account-scoped in the RPC.

update storage.buckets
set file_size_limit = 104857600
where id = 'business-files';

alter table public.central_business_files
  drop constraint if exists central_business_files_size_check;

alter table public.central_business_files
  add constraint central_business_files_size_check
  check (file_size >= 0 and file_size <= 104857600);

create or replace function public.register_central_business_file(
  p_file_id text,
  p_module text,
  p_storage_key text,
  p_entity_id text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_visibility_payload jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns public.central_business_files
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor public.profiles%rowtype;
  v_row public.central_business_files%rowtype;
  v_visibility jsonb;
  v_max_file_size bigint;
begin
  if not public.central_can_write_file_module(p_module) then
    raise exception 'Tidak berwenang upload file module %.', p_module;
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

  v_max_file_size :=
    case
      when upper(trim(p_module)) = 'MARKETING_SUPPORT'
        and coalesce(v_actor.legacy_user_id, '') = 'USR-000031'
      then 104857600
      else 10485760
    end;

  if p_file_size is null
    or p_file_size < 0
    or p_file_size > v_max_file_size
  then
    raise exception
      'Ukuran file maksimum % MB untuk akun ini.',
      (v_max_file_size / 1024 / 1024);
  end if;

  if not public.central_is_supported_storage_key(p_storage_key) then
    raise exception 'Storage key file tidak didukung.';
  end if;

  v_visibility :=
    coalesce(p_visibility_payload, '{}'::jsonb)
    || jsonb_build_object(
      'uploadedByUserId',
      coalesce(v_actor.legacy_user_id, '')
    );

  if not (
    public.central_is_target_support_root()
    or public.central_is_system_admin()
    or public.central_can_mutate_business_entity(
      p_storage_key,
      v_visibility,
      null
    )
    or (
      upper(trim(p_module)) = 'MARKETING_SUPPORT'
      and (
        public.central_is_marketing_administration()
        or public.central_is_marketing_communication()
      )
    )
  ) then
    raise exception 'Tidak berwenang mendaftarkan file untuk record tersebut.';
  end if;

  insert into public.central_business_files (
    file_id,
    module,
    storage_key,
    entity_id,
    storage_path,
    file_name,
    mime_type,
    file_size,
    visibility_payload,
    metadata,
    uploaded_by_profile_id,
    uploaded_by_name,
    uploaded_at
  )
  values (
    trim(p_file_id),
    upper(trim(p_module)),
    trim(p_storage_key),
    nullif(trim(coalesce(p_entity_id, '')), ''),
    trim(p_storage_path),
    trim(p_file_name),
    nullif(trim(coalesce(p_mime_type, '')), ''),
    p_file_size,
    v_visibility,
    coalesce(p_metadata, '{}'::jsonb),
    v_actor.id,
    v_actor.full_name,
    now()
  )
  on conflict (file_id)
  do update
  set
    module = excluded.module,
    storage_key = excluded.storage_key,
    entity_id = excluded.entity_id,
    storage_path = excluded.storage_path,
    file_name = excluded.file_name,
    mime_type = excluded.mime_type,
    file_size = excluded.file_size,
    visibility_payload = excluded.visibility_payload,
    metadata = excluded.metadata,
    uploaded_by_profile_id = excluded.uploaded_by_profile_id,
    uploaded_by_name = excluded.uploaded_by_name,
    uploaded_at = now()
  returning *
  into v_row;

  return v_row;
end;
$function$;
