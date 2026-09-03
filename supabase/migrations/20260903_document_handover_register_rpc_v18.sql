-- Dashboard Marketing PertaLife
-- Tanda Terima V18 — dedicated profile-native evidence metadata RPC
-- 2026-09-03
--
-- Problem addressed:
-- Existing register_central_business_file() has module authorization rules
-- that reject TANDA_TERIMA for profile-native users (P0001), even after
-- Storage RLS and central_business_files RLS already allow the operation.
--
-- This migration deliberately DOES NOT loosen or replace the existing generic
-- RPC. It adds a dedicated RPC for TANDA_TERIMA only, preserving all legacy
-- authorization rules for other modules.

begin;

create or replace function public.register_tanda_terima_business_file_v18(
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
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile_id uuid;
  v_full_name text;
  v_runtime_user_id text;
  v_row jsonb;
  v_columns text;
  v_values text;
  v_required_missing text;
  v_result jsonb;
begin
  select
    p.id,
    p.full_name,
    coalesce(
      nullif(trim(p.legacy_user_id), ''),
      'PRF-' || p.id::text
    )
  into
    v_profile_id,
    v_full_name,
    v_runtime_user_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'PROFILE_ACTIVE_REQUIRED';
  end if;

  if p_module is distinct from 'TANDA_TERIMA' then
    raise exception 'RPC V18 hanya untuk module TANDA_TERIMA.';
  end if;

  if p_storage_key is distinct from 'pertalife_document_handovers' then
    raise exception 'Storage key Tanda Terima tidak valid.';
  end if;

  if nullif(trim(coalesce(p_file_id, '')), '') is null
     or nullif(trim(coalesce(p_entity_id, '')), '') is null
     or nullif(trim(coalesce(p_storage_path, '')), '') is null
     or nullif(trim(coalesce(p_file_name, '')), '') is null
  then
    raise exception 'Metadata evidence Tanda Terima tidak lengkap.';
  end if;

  if p_file_size is null or p_file_size < 1 or p_file_size > 10485760 then
    raise exception 'Ukuran evidence Tanda Terima tidak valid.';
  end if;

  if split_part(p_storage_path, '/', 1) <> 'TANDA_TERIMA' then
    raise exception 'Path evidence harus berada pada folder TANDA_TERIMA.';
  end if;

  if coalesce(p_visibility_payload ->> 'uploadedByUserId', '')
     <> v_runtime_user_id
  then
    raise exception 'Uploader evidence tidak sesuai profile login.';
  end if;

  if nullif(coalesce(p_visibility_payload ->> 'senderUserId', ''), '') is not null
     and nullif(coalesce(p_visibility_payload ->> 'receiverUserId', ''), '') is not null
     and v_runtime_user_id not in (
       p_visibility_payload ->> 'senderUserId',
       p_visibility_payload ->> 'receiverUserId'
     )
  then
    raise exception 'Uploader bukan pihak pada registry Tanda Terima.';
  end if;

  -- Build one row payload that supports both the established schema and
  -- optional audit columns when they exist. Only columns actually present in
  -- central_business_files are included in the dynamic INSERT, so the RPC is
  -- resilient to minor schema-version differences.
  v_row := jsonb_build_object(
    'file_id', p_file_id,
    'module', p_module,
    'storage_key', p_storage_key,
    'entity_id', p_entity_id,
    'storage_path', p_storage_path,
    'file_name', p_file_name,
    'mime_type', coalesce(nullif(trim(p_mime_type), ''), 'application/octet-stream'),
    'file_size', p_file_size,
    'visibility_payload', coalesce(p_visibility_payload, '{}'::jsonb),
    'metadata', coalesce(p_metadata, '{}'::jsonb),
    'uploaded_by_profile_id', v_profile_id,
    'uploaded_by_name', v_full_name,
    'uploaded_at', now(),
    'created_at', now(),
    'updated_at', now()
  );

  -- Refuse to silently null any mandatory, no-default column that this RPC
  -- does not know how to populate.
  select string_agg(c.column_name, ', ' order by c.ordinal_position)
  into v_required_missing
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'central_business_files'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and c.is_identity = 'NO'
    and not (v_row ? c.column_name);

  if v_required_missing is not null then
    raise exception
      'Schema central_business_files membutuhkan kolom yang belum didukung V18: %',
      v_required_missing;
  end if;

  select
    string_agg(
      format('%I', a.attname),
      ', ' order by a.attnum
    ),
    string_agg(
      format(
        '($1 ->> %L)::%s',
        a.attname,
        pg_catalog.format_type(a.atttypid, a.atttypmod)
      ),
      ', ' order by a.attnum
    )
  into
    v_columns,
    v_values
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.central_business_files'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and (v_row ? a.attname);

  if v_columns is null or v_values is null then
    raise exception 'Schema central_business_files tidak dapat dipetakan.';
  end if;

  -- file_id is the logical identifier used by the application. A retry of the
  -- same evidence replaces only its metadata row; physical object cleanup is
  -- still handled by the frontend storage service.
  delete from public.central_business_files
  where file_id = p_file_id;

  execute format(
    'insert into public.central_business_files (%s) values (%s)',
    v_columns,
    v_values
  )
  using v_row;

  select to_jsonb(f)
  into v_result
  from public.central_business_files f
  where f.file_id = p_file_id
  limit 1;

  if v_result is null then
    raise exception 'Metadata evidence Tanda Terima gagal diregistrasikan.';
  end if;

  return v_result;
end;
$function$;

revoke all
on function public.register_tanda_terima_business_file_v18(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb,
  jsonb
)
from public, anon;

grant execute
on function public.register_tanda_terima_business_file_v18(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb,
  jsonb
)
to authenticated;

comment on function public.register_tanda_terima_business_file_v18(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb,
  jsonb
)
is 'Dedicated Tanda Terima evidence metadata registration for authenticated active profiles. Does not alter generic business-file authorization.';

commit;
