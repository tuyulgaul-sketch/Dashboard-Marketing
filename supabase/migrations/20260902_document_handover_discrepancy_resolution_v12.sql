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
  v_old_status text := coalesce(p_old_payload ->> 'status', '');
  v_new_status text := coalesce(p_new_payload ->> 'status', '');
begin
  if jsonb_typeof(p_new_payload) <> 'object' then
    raise exception 'Payload harus berupa JSON object.';
  end if;

  if nullif(trim(coalesce(p_new_payload ->> 'id', '')), '') is null then
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
       and v_new_status <> v_old_status then
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
       and v_new_status <> 'WIN' then
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
       and v_new_status <> v_old_status then
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
       and v_new_status <> v_old_status then

      if v_old_status = 'MENUNGGU PENERIMAAN'
         and v_new_status not in (
           'DITERIMA',
           'SELISIH DOKUMEN',
           'DITOLAK',
           'DIBATALKAN'
         ) then
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

      if v_old_status in (
           'DIKEMBALIKAN',
           'DITOLAK',
           'DIBATALKAN'
         )
      then
        raise exception 'Tanda Terima terminal tidak dapat diubah.';
      end if;

    end if;
  end if;
end;
$function$;
