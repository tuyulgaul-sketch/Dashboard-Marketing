-- Issue #44: additive Agent/Broker bulk import for Marketing Administration.
-- This migration changes no master data. Existing single-record CRUD remains intact.

create or replace function public.can_bulk_manage_intermediary_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.active = true
      and (
        upper(trim(coalesce(p.role_level, ''))) = 'SYSTEM_ADMIN'
        or (
          lower(trim(coalesce(p.unit, ''))) = 'marketing support'
          and lower(trim(coalesce(p.department, ''))) = 'marketing administration'
        )
      )
  )
$$;

revoke all on function public.can_bulk_manage_intermediary_master() from public;
grant execute on function public.can_bulk_manage_intermediary_master() to authenticated;

create or replace function public.bulk_add_master_agents(
  p_rows jsonb,
  p_source_name text default null,
  p_source_period text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_existing public.master_agents%rowtype;
  v_code text;
  v_name text;
  v_company text;
  v_license text;
  v_license_date date;
  v_expiry date;
  v_email text;
  v_status text;
  v_id text;
  v_seen_codes text[] := array[]::text[];
  v_seen_licenses text[] := array[]::text[];
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_total integer := 0;
begin
  if not public.can_bulk_manage_intermediary_master() then
    raise exception 'Bulk Master Agent hanya tersedia untuk Marketing Administration.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Payload Agent harus berupa JSON array.';
  end if;
  v_total := jsonb_array_length(p_rows);
  if v_total < 1 then raise exception 'Payload Agent kosong.'; end if;
  if v_total > 5000 then raise exception 'Payload Agent melebihi batas 5000 record.'; end if;

  -- Full preflight before any INSERT. A validation failure aborts the statement,
  -- so the server never leaves a partially imported batch.
  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_code := trim(coalesce(v_item ->> 'agentCode', ''));
    v_name := trim(coalesce(v_item ->> 'agentName', ''));
    v_company := trim(coalesce(v_item ->> 'insuranceCompany', ''));
    v_license := trim(coalesce(v_item ->> 'licenseNumber', ''));
    v_license_date := nullif(trim(coalesce(v_item ->> 'licenseDate', '')), '')::date;
    v_expiry := nullif(trim(coalesce(v_item ->> 'licenseExpiryDate', '')), '')::date;
    v_email := nullif(trim(coalesce(v_item ->> 'email', '')), '');
    v_status := trim(coalesce(v_item ->> 'status', ''));

    if v_code = '' or v_name = '' or v_company = '' or v_license = '' then
      raise exception 'Kode Agen, Nama Agen, Perusahaan Asuransi, dan Nomor Lisensi wajib diisi.';
    end if;
    if v_status not in ('Active', 'Inactive') then
      raise exception 'Status Agent wajib Active atau Inactive.';
    end if;
    if v_status = 'Active' and v_expiry is not null and v_expiry < current_date then
      raise exception 'Agent % berstatus Active tetapi lisensinya sudah berakhir.', v_code;
    end if;
    if lower(v_code) = any(v_seen_codes) then
      raise exception 'Kode Agen duplikat di dalam batch: %.', v_code;
    end if;
    if lower(v_license) = any(v_seen_licenses) then
      raise exception 'Nomor Lisensi Agent duplikat di dalam batch: %.', v_license;
    end if;
    v_seen_codes := array_append(v_seen_codes, lower(v_code));
    v_seen_licenses := array_append(v_seen_licenses, lower(v_license));

    select * into v_existing
    from public.master_agents a
    where lower(trim(a.agent_code)) = lower(v_code)
       or lower(trim(coalesce(a.license_number, ''))) = lower(v_license)
    limit 1;

    if found then
      if lower(trim(v_existing.agent_code)) = lower(v_code)
         and lower(trim(v_existing.agent_name)) = lower(v_name)
         and lower(trim(v_existing.insurance_company)) = lower(v_company)
         and lower(trim(coalesce(v_existing.license_number, ''))) = lower(v_license)
         and v_existing.license_date is not distinct from v_license_date
         and v_existing.license_expiry_date is not distinct from v_expiry
         and lower(trim(coalesce(v_existing.email, ''))) = lower(coalesce(v_email, ''))
         and v_existing.status = v_status
      then
        v_skipped := v_skipped + 1;
      else
        raise exception 'Agent % / lisensi % sudah ada dengan data berbeda. Gunakan Edit; bulk import tidak menimpa existing.', v_code, v_license;
      end if;
    else
      v_id := 'AGT-BULK-' || upper(substr(md5(lower(v_code)), 1, 20));
      if exists (select 1 from public.master_agents where id = v_id) then
        raise exception 'ID deterministik Agent bertabrakan untuk Kode Agen %.', v_code;
      end if;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_code := trim(coalesce(v_item ->> 'agentCode', ''));
    v_name := trim(coalesce(v_item ->> 'agentName', ''));
    v_company := trim(coalesce(v_item ->> 'insuranceCompany', ''));
    v_license := trim(coalesce(v_item ->> 'licenseNumber', ''));
    v_license_date := nullif(trim(coalesce(v_item ->> 'licenseDate', '')), '')::date;
    v_expiry := nullif(trim(coalesce(v_item ->> 'licenseExpiryDate', '')), '')::date;
    v_email := nullif(trim(coalesce(v_item ->> 'email', '')), '');
    v_status := trim(coalesce(v_item ->> 'status', ''));

    if exists (
      select 1 from public.master_agents a
      where lower(trim(a.agent_code)) = lower(v_code)
         or lower(trim(coalesce(a.license_number, ''))) = lower(v_license)
    ) then
      continue;
    end if;

    v_id := 'AGT-BULK-' || upper(substr(md5(lower(v_code)), 1, 20));
    insert into public.master_agents (
      id, agent_code, agent_name, insurance_company, license_number,
      license_date, license_expiry_date, email, status, source_period, source_name
    ) values (
      v_id, v_code, v_name, v_company, v_license,
      v_license_date, v_expiry, v_email, v_status,
      nullif(trim(coalesce(p_source_period, '')), ''),
      nullif(trim(coalesce(p_source_name, '')), '')
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'total', v_total);
end;
$$;

revoke all on function public.bulk_add_master_agents(jsonb, text, text) from public;
grant execute on function public.bulk_add_master_agents(jsonb, text, text) to authenticated;

create or replace function public.bulk_add_master_brokers(
  p_rows jsonb,
  p_status text,
  p_source_name text default null,
  p_source_period text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_existing public.master_brokers%rowtype;
  v_company text;
  v_license text;
  v_license_date date;
  v_address text;
  v_city text;
  v_postal text;
  v_phone1 text;
  v_phone2 text;
  v_fax text;
  v_email text;
  v_website text;
  v_id text;
  v_seen_companies text[] := array[]::text[];
  v_seen_licenses text[] := array[]::text[];
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_total integer := 0;
begin
  if not public.can_bulk_manage_intermediary_master() then
    raise exception 'Bulk Master Broker hanya tersedia untuk Marketing Administration.';
  end if;
  if p_status not in ('Active', 'Inactive') then
    raise exception 'File Broker tidak memiliki status. Status batch wajib dipilih Active atau Inactive setelah verifikasi sumber.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Payload Broker harus berupa JSON array.';
  end if;
  v_total := jsonb_array_length(p_rows);
  if v_total < 1 then raise exception 'Payload Broker kosong.'; end if;
  if v_total > 5000 then raise exception 'Payload Broker melebihi batas 5000 record.'; end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_company := trim(coalesce(v_item ->> 'companyName', ''));
    v_license := trim(coalesce(v_item ->> 'licenseNumber', ''));
    v_license_date := nullif(trim(coalesce(v_item ->> 'licenseDate', '')), '')::date;
    v_address := nullif(trim(coalesce(v_item ->> 'address', '')), '');
    v_city := nullif(trim(coalesce(v_item ->> 'city', '')), '');
    v_postal := nullif(trim(coalesce(v_item ->> 'postalCode', '')), '');
    v_phone1 := nullif(trim(coalesce(v_item ->> 'phone1', '')), '');
    v_phone2 := nullif(trim(coalesce(v_item ->> 'phone2', '')), '');
    v_fax := nullif(trim(coalesce(v_item ->> 'fax', '')), '');
    v_email := nullif(trim(coalesce(v_item ->> 'email', '')), '');
    v_website := nullif(trim(coalesce(v_item ->> 'website', '')), '');

    if v_company = '' or v_license = '' then
      raise exception 'Nama Perusahaan dan Nomor Izin Usaha Broker wajib diisi.';
    end if;
    if lower(v_company) = any(v_seen_companies) then
      raise exception 'Nama perusahaan Broker duplikat di dalam batch: %.', v_company;
    end if;
    if lower(v_license) = any(v_seen_licenses) then
      raise exception 'Nomor Izin Usaha Broker duplikat di dalam batch: %. Rekonsiliasi wajib dilakukan sebelum import.', v_license;
    end if;
    v_seen_companies := array_append(v_seen_companies, lower(v_company));
    v_seen_licenses := array_append(v_seen_licenses, lower(v_license));

    select * into v_existing
    from public.master_brokers b
    where lower(trim(b.company_name)) = lower(v_company)
       or lower(trim(coalesce(b.license_number, ''))) = lower(v_license)
    limit 1;

    if found then
      if lower(trim(v_existing.company_name)) = lower(v_company)
         and lower(trim(coalesce(v_existing.license_number, ''))) = lower(v_license)
         and v_existing.license_date is not distinct from v_license_date
         and lower(trim(coalesce(v_existing.address, ''))) = lower(coalesce(v_address, ''))
         and lower(trim(coalesce(v_existing.city, ''))) = lower(coalesce(v_city, ''))
         and trim(coalesce(v_existing.postal_code, '')) = coalesce(v_postal, '')
         and trim(coalesce(v_existing.phone1, '')) = coalesce(v_phone1, '')
         and trim(coalesce(v_existing.phone2, '')) = coalesce(v_phone2, '')
         and trim(coalesce(v_existing.fax, '')) = coalesce(v_fax, '')
         and lower(trim(coalesce(v_existing.email, ''))) = lower(coalesce(v_email, ''))
         and lower(trim(coalesce(v_existing.website, ''))) = lower(coalesce(v_website, ''))
         and v_existing.status = p_status
      then
        v_skipped := v_skipped + 1;
      else
        raise exception 'Broker % / izin % sudah ada dengan data berbeda. Gunakan Edit; bulk import tidak menimpa existing.', v_company, v_license;
      end if;
    else
      v_id := 'BRK-BULK-' || upper(substr(md5(lower(v_company) || '|' || lower(v_license)), 1, 20));
      if exists (select 1 from public.master_brokers where id = v_id) then
        raise exception 'ID deterministik Broker bertabrakan untuk %.', v_company;
      end if;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_company := trim(coalesce(v_item ->> 'companyName', ''));
    v_license := trim(coalesce(v_item ->> 'licenseNumber', ''));
    v_license_date := nullif(trim(coalesce(v_item ->> 'licenseDate', '')), '')::date;
    v_address := nullif(trim(coalesce(v_item ->> 'address', '')), '');
    v_city := nullif(trim(coalesce(v_item ->> 'city', '')), '');
    v_postal := nullif(trim(coalesce(v_item ->> 'postalCode', '')), '');
    v_phone1 := nullif(trim(coalesce(v_item ->> 'phone1', '')), '');
    v_phone2 := nullif(trim(coalesce(v_item ->> 'phone2', '')), '');
    v_fax := nullif(trim(coalesce(v_item ->> 'fax', '')), '');
    v_email := nullif(trim(coalesce(v_item ->> 'email', '')), '');
    v_website := nullif(trim(coalesce(v_item ->> 'website', '')), '');

    if exists (
      select 1 from public.master_brokers b
      where lower(trim(b.company_name)) = lower(v_company)
         or lower(trim(coalesce(b.license_number, ''))) = lower(v_license)
    ) then
      continue;
    end if;

    v_id := 'BRK-BULK-' || upper(substr(md5(lower(v_company) || '|' || lower(v_license)), 1, 20));
    insert into public.master_brokers (
      id, company_name, license_number, license_date, address, city, postal_code,
      phone1, phone2, fax, email, website, status, source_period, source_name
    ) values (
      v_id, v_company, v_license, v_license_date, v_address, v_city, v_postal,
      v_phone1, v_phone2, v_fax, v_email, v_website, p_status,
      nullif(trim(coalesce(p_source_period, '')), ''),
      nullif(trim(coalesce(p_source_name, '')), '')
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'total', v_total);
end;
$$;

revoke all on function public.bulk_add_master_brokers(jsonb, text, text, text) from public;
grant execute on function public.bulk_add_master_brokers(jsonb, text, text, text) to authenticated;
