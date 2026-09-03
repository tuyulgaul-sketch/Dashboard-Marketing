-- Dashboard Marketing PertaLife
-- Tanda Terima V14
-- 2026-09-03
--
-- 1. Registry DIKEMBALIKAN dapat dikirim ulang menggunakan nomor TRM yang sama.
-- 2. Directory collaborative module mengikutsertakan profile tanpa legacy_user_id
--    dengan synthetic runtime ID PRF-<profile_uuid>.

begin;

create or replace function public.get_business_user_directory_v14()
returns table (
  profile_id uuid,
  legacy_user_id text,
  full_name text,
  email text,
  role_level text,
  unit text,
  department text,
  manager_profile_id uuid,
  manager_legacy_user_id text,
  active boolean
)
language sql
security definer
stable
set search_path = public
as $function$
  select
    p.id as profile_id,
    coalesce(
      nullif(
        trim(p.legacy_user_id),
        ''
      ),
      'PRF-' || p.id::text
    ) as legacy_user_id,
    p.full_name,
    p.email,
    p.role_level,
    p.unit,
    p.department,
    p.manager_id as manager_profile_id,
    case
      when m.id is null then null
      else coalesce(
        nullif(
          trim(m.legacy_user_id),
          ''
        ),
        'PRF-' || m.id::text
      )
    end as manager_legacy_user_id,
    p.active
  from public.profiles p
  left join public.profiles m
    on m.id = p.manager_id
  where p.active = true
  order by p.full_name;
$function$;

revoke all
on function public.get_business_user_directory_v14()
from public, anon;

grant execute
on function public.get_business_user_directory_v14()
to authenticated;

comment on function public.get_business_user_directory_v14()
is 'Collaborative directory V14. Active profiles without legacy_user_id receive deterministic runtime ID PRF-<profile_uuid>.';


create or replace function public.central_validate_business_transition(
  p_storage_key text,
  p_old_payload jsonb,
  p_new_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old_status text :=
    coalesce(
      p_old_payload ->> 'status',
      ''
    );

  v_new_status text :=
    coalesce(
      p_new_payload ->> 'status',
      ''
    );
begin
  if jsonb_typeof(p_new_payload) <> 'object' then
    raise exception 'Payload harus berupa JSON object.';
  end if;

  if nullif(
       trim(
         coalesce(
           p_new_payload ->> 'id',
           ''
         )
       ),
       ''
     ) is null
  then
    raise exception 'ID record wajib tersedia.';
  end if;

  if p_storage_key = 'pertalife_bookings' then
    if v_new_status not in (
      'Submitted',
      'Claimed',
      'Approved',
      'Rejected'
    ) then
      raise exception 'Status Booking tidak valid: %', v_new_status;
    end if;

    if p_old_payload is not null
       and v_old_status in ('Approved', 'Rejected')
       and v_new_status <> v_old_status
    then
      raise exception 'Booking terminal tidak dapat berpindah status lagi.';
    end if;
  end if;

  if p_storage_key = 'pertalife_pipelines' then
    if v_new_status not in (
      'Menunggu Upload Dokumen Marketing',
      'Dokumen Diajukan oleh Marketing',
      'On Progress Marketing Support',
      'Perlu Perbaikan Dokumen Marketing',
      'On Process Teknik',
      'Penawaran Telah Terbit',
      'Menunggu Feedback / Konfirmasi Klien',
      'Menunggu Upload Dokumen Closing',
      'Dokumen Closing Diajukan',
      'Dalam Verifikasi Marketing Support',
      'Menunggu Final Approval Team Leader Marketing Support',
      'WIN',
      'LOSE'
    ) then
      raise exception 'Status Pipeline tidak valid: %', v_new_status;
    end if;

    if p_old_payload is not null
       and v_old_status = 'WIN'
       and v_new_status <> 'WIN'
    then
      raise exception 'Pipeline WIN bersifat final.';
    end if;

    if p_old_payload is not null
       and v_old_status = 'LOSE'
       and v_new_status <> 'LOSE'
       and not (
         public.central_is_target_support_root()
         or public.central_is_marketing_administration()
       )
    then
      raise exception 'Reopen Pipeline LOSE hanya dapat dilakukan Marketing Support.';
    end if;
  end if;

  if p_storage_key = 'pertalife_productions' then
    if v_new_status not in (
      'Pending Checker',
      'POSTED',
      'Rejected'
    ) then
      raise exception 'Status Produksi tidak valid: %', v_new_status;
    end if;

    if p_old_payload is not null
       and v_old_status in ('POSTED', 'Rejected')
       and v_new_status <> v_old_status
    then
      raise exception 'Transaksi Produksi terminal tidak dapat diubah status.';
    end if;
  end if;

  if p_storage_key = 'pertalife_document_handovers' then
    if v_new_status not in (
      'MENUNGGU PENERIMAAN',
      'DITERIMA',
      'SELISIH DOKUMEN',
      'MENUNGGU KONFIRMASI PENGEMBALIAN',
      'DIKEMBALIKAN',
      'SELISIH PENGEMBALIAN',
      'DITOLAK',
      'DIBATALKAN'
    ) then
      raise exception 'Status Tanda Terima tidak valid: %', v_new_status;
    end if;

    if p_old_payload is not null
       and v_new_status <> v_old_status
    then
      if v_old_status = 'MENUNGGU PENERIMAAN'
         and v_new_status not in (
           'DITERIMA',
           'SELISIH DOKUMEN',
           'DITOLAK',
           'DIBATALKAN'
         )
      then
        raise exception
          'Transisi Tanda Terima tidak valid: % -> %',
          v_old_status,
          v_new_status;
      end if;

      if v_old_status = 'DITERIMA'
         and v_new_status <> 'MENUNGGU KONFIRMASI PENGEMBALIAN'
      then
        raise exception
          'Transisi Tanda Terima tidak valid: % -> %',
          v_old_status,
          v_new_status;
      end if;

      if v_old_status = 'SELISIH DOKUMEN'
         and v_new_status <> 'DITERIMA'
      then
        raise exception
          'Transisi Tanda Terima tidak valid: % -> %',
          v_old_status,
          v_new_status;
      end if;

      if v_old_status = 'MENUNGGU KONFIRMASI PENGEMBALIAN'
         and v_new_status not in (
           'DIKEMBALIKAN',
           'SELISIH PENGEMBALIAN'
         )
      then
        raise exception
          'Transisi Tanda Terima tidak valid: % -> %',
          v_old_status,
          v_new_status;
      end if;

      if v_old_status = 'SELISIH PENGEMBALIAN'
         and v_new_status <> 'DIKEMBALIKAN'
      then
        raise exception
          'Transisi Tanda Terima tidak valid: % -> %',
          v_old_status,
          v_new_status;
      end if;

      -- V14: DIKEMBALIKAN tidak lagi terminal. Registry yang sama dapat
      -- diserahkan ulang oleh pengirim awal, dan UI mempertahankan seluruh
      -- event sebelumnya melalui audit trail + evidence per event.
      if v_old_status = 'DIKEMBALIKAN'
         and v_new_status <> 'MENUNGGU PENERIMAAN'
      then
        raise exception
          'Registry yang sudah dikembalikan hanya dapat dikirim ulang ke proses penerimaan.';
      end if;

      if v_old_status in (
           'DITOLAK',
           'DIBATALKAN'
         )
      then
        raise exception 'Tanda Terima yang ditolak atau dibatalkan bersifat terminal.';
      end if;
    end if;
  end if;
end;
$function$;

comment on function public.central_validate_business_transition(
  text,
  jsonb,
  jsonb
)
is 'Business transition validator V14. Tanda Terima DIKEMBALIKAN may transition back to MENUNGGU PENERIMAAN for same-registry resend.';

commit;
