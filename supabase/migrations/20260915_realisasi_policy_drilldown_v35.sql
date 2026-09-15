-- Realisasi per Produk policy drill-down.
-- Adds a publisher-owned compact detail collection and a scope-filtered read projection.
-- Existing Official Production summaries remain the authoritative parent totals.

create or replace function public.central_business_storage_keys()
returns text[]
language sql
immutable
set search_path = public
as $function$
  select array[
    'pertalife_bookings',
    'pertalife_pipelines',
    'pertalife_appeals',
    'pertalife_productions',
    'pertalife_official_production_summaries',
    'pertalife_official_production_batches',
    'pertalife_official_policy_directory',
    'pertalife_official_production_policy_details',
    'pertalife_service_documents',
    'pertalife_marcomm_requests',
    'pertalife_marcomm_stock_transactions',
    'pertalife_marcomm_stock_opnames',
    'pertalife_participants',
    'pertalife_historical',
    'pertalife_activities',
    'pertalife_activity_comments',
    'pertalife_reimbursements',
    'pertalife_supporting_docs',
    'pertalife_audit_logs',
    'pertalife_notifications',
    'pertalife_approver_delegations',
    'pertalife_document_handovers'
  ]::text[]
$function$;

-- Backfill the best detail still available from the existing policy directory.
-- Old policy-directory rows retain only the latest policy amount, so the UI will
-- transparently reconcile any historical remainder to the authoritative parent.
insert into public.central_business_entities (
  storage_key,
  entity_id,
  payload,
  relation_user_id,
  status,
  entity_year,
  dedupe_key,
  version,
  created_by_profile_id,
  updated_by_profile_id,
  created_at,
  updated_at
)
select
  'pertalife_official_production_policy_details',
  'OPD-LEGACY-' || md5(p.entity_id),
  jsonb_build_object(
    'id', 'OPD-LEGACY-' || md5(p.entity_id),
    'productionYear', (p.payload ->> 'productionYear')::integer,
    'productionMonth', (p.payload ->> 'productionMonth')::integer,
    'policyNumber', coalesce(p.payload ->> 'policyNumber', ''),
    'customerName', coalesce(p.payload ->> 'customerName', 'Pemegang polis belum teridentifikasi'),
    'productName', coalesce(p.payload ->> 'productName', 'Produk belum terpetakan'),
    'productionAmount', coalesce((p.payload ->> 'lastProductionAmount')::numeric, 0),
    'sourceRowCount', 1,
    'marketingFunction', coalesce(p.payload ->> 'marketingFunction', ''),
    'department', coalesce(nullif(p.payload ->> 'department', ''), 'None'),
    'businessType', coalesce(p.payload ->> 'businessType', ''),
    'picUserId', coalesce(p.payload ->> 'picUserId', ''),
    'sourceBatchId', coalesce(p.payload ->> 'sourceBatchId', ''),
    'sourceFilename', coalesce(b.payload ->> 'filename', ''),
    'legacyBackfill', true
  ),
  nullif(trim(coalesce(p.payload ->> 'picUserId', '')), ''),
  null,
  nullif(p.payload ->> 'productionYear', '')::integer,
  null,
  1,
  p.created_by_profile_id,
  p.updated_by_profile_id,
  now(),
  now()
from public.central_business_entities p
join public.central_business_entities b
  on b.storage_key = 'pertalife_official_production_batches'
 and b.entity_id = p.payload ->> 'sourceBatchId'
where p.storage_key = 'pertalife_official_policy_directory'
  and b.payload ->> 'status' = 'Published'
  and nullif(p.payload ->> 'productionYear', '') is not null
  and nullif(p.payload ->> 'productionMonth', '') is not null
on conflict (storage_key, entity_id) do nothing;

create or replace function public.guard_official_performance_upload_v35()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_protected boolean := false;
  v_old_source text;
  v_new_source text;
begin
  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_protected := new.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches',
      'pertalife_official_production_policy_details'
    );
    v_new_source := upper(trim(coalesce(new.payload ->> 'source', '')));
    if new.storage_key = 'pertalife_pipelines' and v_new_source = 'RKAP_BULK' then
      v_protected := true;
    end if;
  elsif tg_op = 'UPDATE' then
    v_protected := old.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches',
      'pertalife_official_production_policy_details'
    ) or new.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches',
      'pertalife_official_production_policy_details'
    );
    v_old_source := upper(trim(coalesce(old.payload ->> 'source', '')));
    v_new_source := upper(trim(coalesce(new.payload ->> 'source', '')));
    if new.storage_key = 'pertalife_pipelines'
       and v_new_source = 'RKAP_BULK'
       and v_old_source <> 'RKAP_BULK' then
      v_protected := true;
    end if;
  else
    v_protected := old.storage_key in (
      'pertalife_official_production_summaries',
      'pertalife_official_production_batches',
      'pertalife_official_production_policy_details'
    );
  end if;

  if v_protected and not public.can_publish_marketing_targets() then
    raise exception 'Hanya publisher Target dan Realisasi yang berwenang melakukan upload Official atau Bulk Pipeline.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function public.guard_official_performance_upload_v35() from public, anon, authenticated;

drop trigger if exists central_official_performance_upload_guard_v34 on public.central_business_entities;
drop trigger if exists central_official_performance_upload_insert_v34 on public.central_business_entities;
drop trigger if exists central_official_performance_upload_guard_v35 on public.central_business_entities;
drop trigger if exists central_official_performance_upload_insert_v35 on public.central_business_entities;

create trigger central_official_performance_upload_guard_v35
before update or delete on public.central_business_entities
for each row execute function public.guard_official_performance_upload_v35();

create trigger central_official_performance_upload_insert_v35
after insert on public.central_business_entities
for each row execute function public.guard_official_performance_upload_v35();

create or replace function public.list_directorate_performance_v35()
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
  v_can_publish boolean := false;
begin
  if not exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.active = true
      and not (
        (lower(trim(coalesce(p.role_level, ''))) like '%system%'
         and lower(trim(coalesce(p.role_level, ''))) like '%admin%')
        or lower(trim(coalesce(p.unit, ''))) = 'administrasi sistem'
      )
  ) then
    raise exception 'Akses laporan Direktorat Marketing ditolak.' using errcode = '42501';
  end if;

  v_can_publish := coalesce(public.can_publish_marketing_targets(), false);

  with target_months as (
    select
      t.target_year as year,
      coalesce(nullif(trim(t.unit), ''), 'None') as unit,
      coalesce(nullif(trim(t.department), ''), 'None') as department,
      m.month,
      sum(coalesce(t.personal_target_total, 0)) as annual_total,
      sum(coalesce(t.personal_target_new_business, 0)) as annual_nb,
      sum(coalesce(t.personal_target_renewal, 0)) as annual_rn,
      sum(coalesce(t.monthly_new_business[m.month], 0)) as monthly_nb,
      sum(coalesce(t.monthly_renewal[m.month], 0)) as monthly_rn,
      max(t.published_at) as published_at
    from public.marketing_targets t
    join public.marketing_target_batches b on b.id = t.batch_id
    cross join generate_series(1, 12) as m(month)
    where b.is_current = true and b.status = 'Published'
    group by t.target_year, t.unit, t.department, m.month
  ), target_groups as (
    select year, unit, department,
      max(annual_total) as annual_total,
      max(annual_nb) as annual_nb,
      max(annual_rn) as annual_rn,
      jsonb_agg(monthly_nb order by month) as monthly_nb,
      jsonb_agg(monthly_rn order by month) as monthly_rn,
      max(published_at) as published_at
    from target_months
    group by year, unit, department
  ), official_rows as (
    select s.entity_id, s.payload, b.payload as batch_payload
    from public.central_business_entities s
    join public.central_business_entities b
      on b.storage_key = 'pertalife_official_production_batches'
     and b.entity_id = s.payload ->> 'batchId'
    where s.storage_key = 'pertalife_official_production_summaries'
      and b.payload ->> 'status' = 'Published'
  ), official_details as (
    select d.entity_id, d.payload
    from public.central_business_entities d
    join public.central_business_entities b
      on b.storage_key = 'pertalife_official_production_batches'
     and b.entity_id = d.payload ->> 'sourceBatchId'
    where d.storage_key = 'pertalife_official_production_policy_details'
      and b.payload ->> 'status' = 'Published'
      and (
        v_can_publish
        or public.central_user_id_in_current_scope(d.payload ->> 'picUserId')
      )
  )
  select jsonb_build_object(
    'refreshedAt', now(),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'year', year, 'unit', unit, 'department', department,
        'annualTotal', annual_total, 'annualNB', annual_nb, 'annualRN', annual_rn,
        'monthlyNB', monthly_nb, 'monthlyRN', monthly_rn,
        'publishedAt', published_at
      ) order by year, unit, department) from target_groups
    ), '[]'::jsonb),
    'summaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entity_id,
        'year', (payload ->> 'productionYear')::integer,
        'month', (payload ->> 'productionMonth')::integer,
        'unit', payload ->> 'marketingFunction',
        'department', payload ->> 'department',
        'businessType', payload ->> 'businessType',
        'productName', payload ->> 'productName',
        'amount', (payload ->> 'productionAmount')::numeric,
        'transactionCount', coalesce((payload ->> 'transactionCount')::integer, 0)
      ) order by (payload ->> 'productionYear')::integer,
                 (payload ->> 'productionMonth')::integer, entity_id)
      from official_rows
    ), '[]'::jsonb),
    'details', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entity_id,
        'year', (payload ->> 'productionYear')::integer,
        'month', (payload ->> 'productionMonth')::integer,
        'unit', payload ->> 'marketingFunction',
        'department', coalesce(nullif(payload ->> 'department', ''), 'None'),
        'businessType', payload ->> 'businessType',
        'productName', payload ->> 'productName',
        'policyNumber', coalesce(payload ->> 'policyNumber', ''),
        'customerName', coalesce(payload ->> 'customerName', 'Pemegang polis belum teridentifikasi'),
        'amount', coalesce((payload ->> 'productionAmount')::numeric, 0),
        'sourceRows', coalesce((payload ->> 'sourceRowCount')::integer, 1),
        'picUserId', coalesce(payload ->> 'picUserId', ''),
        'sourceBatchId', coalesce(payload ->> 'sourceBatchId', ''),
        'legacyBackfill', coalesce((payload ->> 'legacyBackfill')::boolean, false)
      ) order by (payload ->> 'productionYear')::integer,
                 (payload ->> 'productionMonth')::integer,
                 payload ->> 'productName',
                 payload ->> 'customerName',
                 entity_id)
      from official_details
    ), '[]'::jsonb),
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.entity_id,
        'uploadedAt', b.payload ->> 'uploadedAt',
        'uploadedByName', b.payload ->> 'uploadedByName',
        'filename', b.payload ->> 'filename',
        'publishedPeriodKeys', coalesce(b.payload -> 'publishedPeriodKeys', '[]'::jsonb),
        'totalProductionAmount', coalesce((b.payload ->> 'totalProductionAmount')::numeric, 0),
        'validRowCount', coalesce((b.payload ->> 'validRowCount')::integer, 0)
      ) order by b.payload ->> 'uploadedAt' desc, b.entity_id desc)
      from public.central_business_entities b
      where b.storage_key = 'pertalife_official_production_batches'
        and b.payload ->> 'status' = 'Published'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.list_directorate_performance_v35() from public, anon;
grant execute on function public.list_directorate_performance_v35() to authenticated;
comment on function public.list_directorate_performance_v35() is
  'Authenticated directorate performance aggregates plus policy/customer detail restricted to publisher or current hierarchy scope.';
